-- Migration: Add Reckoning-sourced reflection questions for existing users
-- These were previously hardcoded prompted entries; now part of the reflections system.
-- The existing default "What am I grateful for today?" already covers gratitude.

INSERT INTO reflection_questions (user_id, question_text, is_default, is_ai_suggested, sort_order)
SELECT u.id, q.question_text, true, false, q.sort_order
FROM auth.users u
CROSS JOIN (
  VALUES
    ('What brought you joy recently?', 13),
    ('What are you looking forward to?', 14)
) AS q(question_text, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM reflection_questions rq
  WHERE rq.user_id = u.id
    AND rq.question_text = q.question_text
    AND rq.archived_at IS NULL
);
