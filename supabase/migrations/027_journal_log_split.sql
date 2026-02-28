-- Migration 027: Journal / Log Split Architecture
-- Renames log_entries → journal_entries (user-created content)
-- Creates activity_log table (auto-populated activity timeline)

BEGIN;

-- ============================================================
-- 1. Rename log_entries → journal_entries
-- ============================================================

ALTER TABLE public.log_entries RENAME TO journal_entries;

-- ============================================================
-- 2. Rename entry_type 'journal' → 'journal_entry'
-- ============================================================

UPDATE public.journal_entries SET entry_type = 'journal_entry' WHERE entry_type = 'journal';

-- ============================================================
-- 3. Rename FK columns in referencing tables
-- ============================================================

ALTER TABLE public.hold_dumps RENAME COLUMN log_entry_id TO journal_entry_id;
ALTER TABLE public.reflection_responses RENAME COLUMN log_entry_id TO journal_entry_id;

-- ============================================================
-- 4. Drop and recreate RLS policies (policies don't auto-rename)
-- ============================================================

DROP POLICY IF EXISTS "Users can select own log_entries" ON public.journal_entries;
DROP POLICY IF EXISTS "Users can insert own log_entries" ON public.journal_entries;
DROP POLICY IF EXISTS "Users can update own log_entries" ON public.journal_entries;
DROP POLICY IF EXISTS "Users can delete own log_entries" ON public.journal_entries;

CREATE POLICY "Users can select own journal_entries"
  ON public.journal_entries FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own journal_entries"
  ON public.journal_entries FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own journal_entries"
  ON public.journal_entries FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own journal_entries"
  ON public.journal_entries FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- 5. Rename indexes for consistency
-- ============================================================

ALTER INDEX IF EXISTS idx_log_entries_user_created RENAME TO idx_journal_entries_user_created;
ALTER INDEX IF EXISTS idx_log_entries_user_type_active RENAME TO idx_journal_entries_user_type_active;
ALTER INDEX IF EXISTS idx_log_entries_user_active RENAME TO idx_journal_entries_user_active;
ALTER INDEX IF EXISTS idx_log_entries_life_area_tags RENAME TO idx_journal_entries_life_area_tags;
ALTER INDEX IF EXISTS idx_log_entries_text_search RENAME TO idx_journal_entries_text_search;
ALTER INDEX IF EXISTS idx_log_entries_rigging_plan RENAME TO idx_journal_entries_rigging_plan;

-- ============================================================
-- 6. Migrate Hatch data: 'log' → 'journal'
-- ============================================================

UPDATE public.hatch_routing_stats SET destination = 'journal' WHERE destination = 'log';
UPDATE public.hatch_tabs SET routed_to = 'journal' WHERE routed_to = 'log';
UPDATE public.hatch_extracted_items SET suggested_destination = 'journal' WHERE suggested_destination = 'log';
UPDATE public.hatch_extracted_items SET actual_destination = 'journal' WHERE actual_destination = 'log';

-- ============================================================
-- 7. Create activity_log table
-- ============================================================

CREATE TABLE IF NOT EXISTS public.activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  display_text TEXT NOT NULL,
  source_table TEXT,
  source_record_id UUID,
  source_url TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  hidden BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_activity_log_user_created ON public.activity_log (user_id, created_at DESC);
CREATE INDEX idx_activity_log_user_event ON public.activity_log (user_id, event_type);
CREATE INDEX idx_activity_log_not_hidden ON public.activity_log (user_id, created_at DESC) WHERE hidden = false;
CREATE INDEX idx_activity_log_source ON public.activity_log (source_table, source_record_id);

-- RLS: read + update only (inserts come from triggers)
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own activity_log"
  ON public.activity_log FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own activity_log"
  ON public.activity_log FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- 8. Auto-logging trigger functions
--    Each wrapped in BEGIN...EXCEPTION to never fail the source op
-- ============================================================

-- Task completion
CREATE OR REPLACE FUNCTION public.activity_log_on_task_complete()
RETURNS TRIGGER AS $$
BEGIN
  BEGIN
    INSERT INTO public.activity_log (user_id, event_type, display_text, source_table, source_record_id, source_url, metadata)
    VALUES (
      NEW.user_id,
      'task_completed',
      'Completed task: ' || LEFT(NEW.title, 100),
      'compass_tasks',
      NEW.id,
      '/compass?task=' || NEW.id,
      jsonb_build_object('title', NEW.title, 'life_area', COALESCE(NEW.life_area_tag, ''))
    );
  EXCEPTION WHEN OTHERS THEN
    -- Never fail the source operation
    NULL;
  END;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER activity_log_task_complete
  AFTER UPDATE OF status ON public.compass_tasks
  FOR EACH ROW
  WHEN (NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed')
  EXECUTE FUNCTION public.activity_log_on_task_complete();

-- Victory recorded
CREATE OR REPLACE FUNCTION public.activity_log_on_victory_insert()
RETURNS TRIGGER AS $$
BEGIN
  BEGIN
    INSERT INTO public.activity_log (user_id, event_type, display_text, source_table, source_record_id, source_url, metadata)
    VALUES (
      NEW.user_id,
      'victory_recorded',
      'Recorded victory: ' || LEFT(COALESCE(NEW.description, 'Victory'), 100),
      'victories',
      NEW.id,
      '/victories?id=' || NEW.id,
      jsonb_build_object('description', LEFT(COALESCE(NEW.description, ''), 200))
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER activity_log_victory
  AFTER INSERT ON public.victories
  FOR EACH ROW EXECUTE FUNCTION public.activity_log_on_victory_insert();

-- Meeting held
CREATE OR REPLACE FUNCTION public.activity_log_on_meeting_insert()
RETURNS TRIGGER AS $$
BEGIN
  BEGIN
    INSERT INTO public.activity_log (user_id, event_type, display_text, source_table, source_record_id, source_url, metadata)
    VALUES (
      NEW.user_id,
      'meeting_completed',
      'Held ' || COALESCE(NEW.meeting_type, 'meeting'),
      'meetings',
      NEW.id,
      '/meetings?id=' || NEW.id,
      jsonb_build_object('meeting_type', COALESCE(NEW.meeting_type, ''))
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER activity_log_meeting
  AFTER INSERT ON public.meetings
  FOR EACH ROW EXECUTE FUNCTION public.activity_log_on_meeting_insert();

-- Helm conversation started
CREATE OR REPLACE FUNCTION public.activity_log_on_helm_conversation_insert()
RETURNS TRIGGER AS $$
BEGIN
  BEGIN
    INSERT INTO public.activity_log (user_id, event_type, display_text, source_table, source_record_id, source_url, metadata)
    VALUES (
      NEW.user_id,
      'helm_conversation_started',
      'Started conversation' || CASE WHEN NEW.title IS NOT NULL THEN ': ' || LEFT(NEW.title, 80) ELSE '' END,
      'helm_conversations',
      NEW.id,
      '/helm?conversation=' || NEW.id,
      jsonb_build_object('guided_mode', COALESCE(NEW.guided_mode, 'free'))
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER activity_log_helm_conversation
  AFTER INSERT ON public.helm_conversations
  FOR EACH ROW EXECUTE FUNCTION public.activity_log_on_helm_conversation_insert();

-- Journal entry created
CREATE OR REPLACE FUNCTION public.activity_log_on_journal_entry_insert()
RETURNS TRIGGER AS $$
BEGIN
  BEGIN
    INSERT INTO public.activity_log (user_id, event_type, display_text, source_table, source_record_id, source_url, metadata)
    VALUES (
      NEW.user_id,
      'journal_entry_created',
      'Wrote ' || COALESCE(NEW.entry_type, 'journal') || ' entry' ||
        CASE WHEN LENGTH(NEW.text) > 0 THEN ': ' || LEFT(NEW.text, 80) ELSE '' END,
      'journal_entries',
      NEW.id,
      '/journal?entry=' || NEW.id,
      jsonb_build_object('entry_type', COALESCE(NEW.entry_type, 'journal_entry'))
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER activity_log_journal_entry
  AFTER INSERT ON public.journal_entries
  FOR EACH ROW EXECUTE FUNCTION public.activity_log_on_journal_entry_insert();

-- Keel entry added
CREATE OR REPLACE FUNCTION public.activity_log_on_keel_entry_insert()
RETURNS TRIGGER AS $$
BEGIN
  BEGIN
    INSERT INTO public.activity_log (user_id, event_type, display_text, source_table, source_record_id, source_url, metadata)
    VALUES (
      NEW.user_id,
      'keel_entry_added',
      'Added to Keel: ' || LEFT(NEW.text, 80),
      'keel_entries',
      NEW.id,
      '/keel?entry=' || NEW.id,
      jsonb_build_object('category', COALESCE(NEW.category, ''))
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER activity_log_keel_entry
  AFTER INSERT ON public.keel_entries
  FOR EACH ROW EXECUTE FUNCTION public.activity_log_on_keel_entry_insert();

-- Mast entry added
CREATE OR REPLACE FUNCTION public.activity_log_on_mast_entry_insert()
RETURNS TRIGGER AS $$
BEGIN
  BEGIN
    INSERT INTO public.activity_log (user_id, event_type, display_text, source_table, source_record_id, source_url, metadata)
    VALUES (
      NEW.user_id,
      'mast_entry_added',
      'Added ' || COALESCE(NEW.entry_type, 'entry') || ' to Mast',
      'mast_entries',
      NEW.id,
      '/mast?entry=' || NEW.id,
      jsonb_build_object('entry_type', COALESCE(NEW.entry_type, ''))
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER activity_log_mast_entry
  AFTER INSERT ON public.mast_entries
  FOR EACH ROW EXECUTE FUNCTION public.activity_log_on_mast_entry_insert();

COMMIT;
