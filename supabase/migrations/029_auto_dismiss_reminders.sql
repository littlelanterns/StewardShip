-- Migration 029: Auto-dismiss reminders when related tasks are completed or archived

-- When a task is completed, dismiss any pending/delivered/snoozed reminders linked to it
CREATE OR REPLACE FUNCTION public.dismiss_reminders_on_task_complete()
RETURNS TRIGGER AS $$
BEGIN
  BEGIN
    UPDATE public.reminders
    SET status = 'dismissed', updated_at = now()
    WHERE user_id = NEW.user_id
      AND related_entity_type = 'compass_task'
      AND related_entity_id = NEW.id
      AND status IN ('pending', 'delivered', 'snoozed');
  EXCEPTION WHEN OTHERS THEN
    NULL; -- Never fail the source operation
  END;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER auto_dismiss_reminders_on_task_complete
  AFTER UPDATE OF status ON public.compass_tasks
  FOR EACH ROW
  WHEN (NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed')
  EXECUTE FUNCTION public.dismiss_reminders_on_task_complete();

-- When a task is archived, dismiss any pending/delivered/snoozed reminders linked to it
CREATE OR REPLACE FUNCTION public.dismiss_reminders_on_task_archive()
RETURNS TRIGGER AS $$
BEGIN
  BEGIN
    UPDATE public.reminders
    SET status = 'dismissed', updated_at = now()
    WHERE user_id = NEW.user_id
      AND related_entity_type = 'compass_task'
      AND related_entity_id = NEW.id
      AND status IN ('pending', 'delivered', 'snoozed');
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER auto_dismiss_reminders_on_task_archive
  AFTER UPDATE OF archived_at ON public.compass_tasks
  FOR EACH ROW
  WHEN (NEW.archived_at IS NOT NULL AND OLD.archived_at IS NULL)
  EXECUTE FUNCTION public.dismiss_reminders_on_task_archive();

-- One-time cleanup: dismiss stale reminders for already-completed tasks
UPDATE reminders r
SET status = 'dismissed', updated_at = now()
FROM compass_tasks t
WHERE r.related_entity_type = 'compass_task'
  AND r.related_entity_id = t.id
  AND t.status = 'completed'
  AND r.status IN ('pending', 'delivered', 'snoozed');

-- One-time cleanup: dismiss stale reminders for already-archived tasks
UPDATE reminders r
SET status = 'dismissed', updated_at = now()
FROM compass_tasks t
WHERE r.related_entity_type = 'compass_task'
  AND r.related_entity_id = t.id
  AND t.archived_at IS NOT NULL
  AND r.status IN ('pending', 'delivered', 'snoozed');
