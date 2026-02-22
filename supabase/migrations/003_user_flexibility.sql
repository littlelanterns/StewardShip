-- ADDENDUM: User Flexibility — Gender & Relationship Status
-- Adds gender and relationship_status to user_profiles
-- Renames gendered enum values in spouse_insights and spouse_prompts

-- ─── Add columns to user_profiles ───

ALTER TABLE public.user_profiles
  ADD COLUMN gender TEXT DEFAULT NULL,
  ADD COLUMN relationship_status TEXT DEFAULT NULL;

-- ─── Rename gendered category in spouse_insights ───
-- 'her_world' → 'their_world' (displayed dynamically as His/Her/Their World)

UPDATE public.spouse_insights
  SET category = 'their_world'
  WHERE category = 'her_world';

-- ─── Rename gendered prompt_type in spouse_prompts ───
-- 'ask_her' → 'ask_them' (button displayed dynamically as Ask Him/Her/Them)

UPDATE public.spouse_prompts
  SET prompt_type = 'ask_them'
  WHERE prompt_type = 'ask_her';
