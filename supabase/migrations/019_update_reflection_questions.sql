-- Migration 019: Update default reflection questions
-- Replaces old 12 defaults with new 13 for all existing users

-- Step 1: Archive the 6 removed default questions (preserves response history)
UPDATE reflection_questions
SET archived_at = now()
WHERE is_default = true
  AND archived_at IS NULL
  AND question_text IN (
    'How did I take care of my body today?',
    'What conversation or interaction stood out today?',
    'What is weighing on my mind right now?',
    'How did I grow closer to God today?',
    'What is one small win I can celebrate?',
    'If I could give my past self advice from today, what would it be?'
  );

-- Step 2: Archive the 5 old defaults that are being replaced with better versions
UPDATE reflection_questions
SET archived_at = now()
WHERE is_default = true
  AND archived_at IS NULL
  AND question_text IN (
    'What challenged me today, and what did I learn from it?',
    'How did I show up for the people who matter most?',
    'What is one thing I did today that aligned with my values?',
    'Where did I fall short today, and what would I do differently?',
    'What am I looking forward to tomorrow?'
  );

-- Step 3: Insert the new default questions for each existing user
-- Only inserts if the exact question_text doesn't already exist for that user
INSERT INTO reflection_questions (user_id, question_text, is_default, is_ai_suggested, sort_order)
SELECT u.id, q.question_text, true, false, q.sort_order
FROM auth.users u
CROSS JOIN (
  VALUES
    ('What am I grateful for today?', 0),
    ('What obstacle did I face today, and what did I do to overcome it?', 1),
    ('What was a moment that made me appreciate another family member?', 2),
    ('How did I move toward my divine identity or life purpose today?', 3),
    ('What was a moment that inspired awe, wonder, or joy?', 4),
    ('What did I love about today?', 5),
    ('What was something interesting I learned or discovered?', 6),
    ('What goal did I make progress on?', 7),
    ('How well did I attend to my duties today?', 8),
    ('How did I serve today?', 9),
    ('What would my future self thank me for today?', 10),
    ('What made me laugh today?', 11),
    ('Where did I fall short today, and what would I do differently?', 12)
) AS q(question_text, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM reflection_questions rq
  WHERE rq.user_id = u.id
    AND rq.question_text = q.question_text
    AND rq.archived_at IS NULL
);

-- Note: "What am I grateful for today?" and "Where did I fall short today..."
-- already exist for current users. The NOT EXISTS prevents duplicates.
-- The old versions stay archived with their response history intact.
