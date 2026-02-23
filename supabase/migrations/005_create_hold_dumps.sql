-- PRD-20: Unload the Hold — hold_dumps table
-- Tracks brain dump triage sessions linked to Helm conversations

-- Create hold_dumps table
CREATE TABLE IF NOT EXISTS public.hold_dumps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES public.helm_conversations(id) ON DELETE CASCADE,
  items_extracted INTEGER NOT NULL DEFAULT 0,
  items_routed INTEGER NOT NULL DEFAULT 0,
  items_discarded INTEGER NOT NULL DEFAULT 0,
  triage_result JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'dumping',
  log_entry_id UUID REFERENCES public.log_entries(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_hold_dumps_user_created ON public.hold_dumps(user_id, created_at DESC);
CREATE INDEX idx_hold_dumps_user_status ON public.hold_dumps(user_id, status);
CREATE INDEX idx_hold_dumps_conversation ON public.hold_dumps(conversation_id);

-- RLS
ALTER TABLE public.hold_dumps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users CRUD own hold dumps" ON public.hold_dumps
  FOR ALL USING (auth.uid() = user_id);

-- Updated at trigger
CREATE TRIGGER set_hold_dumps_updated_at
  BEFORE UPDATE ON public.hold_dumps
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
