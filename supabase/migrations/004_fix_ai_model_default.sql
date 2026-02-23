-- Fix invalid OpenRouter model ID: 'anthropic/claude-sonnet' → 'anthropic/claude-sonnet-4'
UPDATE user_settings SET ai_model = 'anthropic/claude-sonnet-4' WHERE ai_model = 'anthropic/claude-sonnet';
ALTER TABLE user_settings ALTER COLUMN ai_model SET DEFAULT 'anthropic/claude-sonnet-4';
