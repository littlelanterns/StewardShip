-- Migration 023: Mentor meeting type support and custom_title columns

-- Add custom_title to meeting_schedules for user-editable display names
ALTER TABLE meeting_schedules ADD COLUMN IF NOT EXISTS custom_title TEXT;

-- Add custom_title to meetings for per-instance title (inherited from schedule or overridden)
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS custom_title TEXT;
