-- Rename her_response to their_response for consistency
-- (her_world → their_world was already done in 003)
UPDATE spouse_insights SET category = 'their_response' WHERE category = 'her_response';
