# ADDENDUM: User Flexibility — Gender, Relationship Status, and Inclusive Adaptation

> This addendum modifies the behavior and language of StewardShip to support users of any gender and relationship status.
> It applies across all PRDs and should be read alongside them.
> Created: February 2026

---

## Purpose

The original PRDs were written with a specific initial user in mind: a married man with a faith background. This addendum extends StewardShip to serve:

- **Any gender** (male, female, non-binary)
- **Any relationship status** (single, dating/courting, married, divorced/widowed)
- **Any faith context** (already supported — this addendum reinforces it)

The core frameworks, AI behavior principles, and feature architecture remain unchanged. What changes is **language**, **feature visibility**, and **contextual adaptation** based on what the user tells us about themselves.

---

## Database Changes

### `user_profiles` — Add Two Columns

| Column | Type | Default | Nullable | Notes |
|--------|------|---------|----------|-------|
| gender | TEXT | null | NULL | Enum: 'male', 'female', 'non_binary', 'prefer_not_to_say'. Set during onboarding or Settings. Null until set. |
| relationship_status | TEXT | null | NULL | Enum: 'single', 'dating', 'married', 'divorced', 'widowed'. Set during onboarding or Settings. Null until set. |

**Migration:**
```sql
ALTER TABLE user_profiles ADD COLUMN gender TEXT DEFAULT null;
ALTER TABLE user_profiles ADD COLUMN relationship_status TEXT DEFAULT null;
```

These columns are **optional**. If null, the AI uses gender-neutral language and does not assume relationship status. The user can set these during onboarding or change them anytime in Settings.

### `people` table — No structural changes needed

The existing `is_first_mate` boolean and `relationship_type = 'spouse'` already support any gender configuration. A female user's husband or a male user's wife both work with the same schema. The `relationship_type` enum already includes 'spouse' which is gender-neutral at the data level.

### `spouse_insights` table — No structural changes needed

The category enum includes 'her_world' which is gendered. This should be renamed:

| Old Value | New Value |
|-----------|-----------|
| `her_world` | `their_world` |

**Migration:**
```sql
UPDATE spouse_insights SET category = 'their_world' WHERE category = 'her_world';
-- Then update the enum constraint if one exists
```

The AI displays this category with the appropriate label based on the spouse's gender ("His World", "Her World", or "Their World").

### `spouse_prompts` table — No structural changes needed

The `prompt_type` enum values ('ask_her', 'reflect', 'express') have one gendered value. Rename:

| Old Value | New Value |
|-----------|-----------|
| `ask_her` | `ask_them` |

**Migration:**
```sql
UPDATE spouse_prompts SET prompt_type = 'ask_them' WHERE prompt_type = 'ask_her';
```

The AI displays the button label dynamically: "Ask Him", "Ask Her", or "Ask Them" based on the spouse's known gender (inferred from context or explicitly set).

---

## Feature Visibility by Relationship Status

| Feature | Single | Dating/Courting | Married | Divorced/Widowed |
|---------|--------|-----------------|---------|-------------------|
| First Mate (PRD-12) | Hidden | Available (adapted) | Full | Available (adapted) |
| Marriage Toolbox | Hidden | Hidden | Full | Hidden |
| Couple Meeting (PRD-17) | Hidden | Available (adapted) | Full | Hidden |
| Sacred Triangle framing | Self + God | Self + Partner + God (if faith) | Self + Spouse + God | Self + God |
| Sphere Focus center | Self, God | Self, Partner (optional), God | Self, Spouse, God | Self, God |
| 21 Compliments Practice | Hidden | Available (adapted) | Full | Hidden |
| Spouse Prompts | Hidden | Available (adapted) | Full | Hidden |

### "Hidden" means:
- The feature does not appear in navigation
- The AI does not reference it
- No onboarding step for it
- Database tables still exist (no structural difference), just unused

### "Available (adapted)" means:
- Feature is visible but language and framing adjust
- "First Mate" becomes "Partner Profile" for dating users
- Marriage Toolbox modes that assume cohabitation or deep commitment are hidden for dating users
- Sacred triangle adapts: "partner" instead of "spouse" for dating users
- Couple Meeting agenda adapts to dating context (lighter commitment framing)

### Divorced/Widowed specifics:
- If the user had a First Mate profile and their status changes to divorced/widowed, the profile is archived (not deleted)
- The AI handles this with sensitivity — no references to the former spouse unless the user brings them up
- First Mate can be re-activated if the user enters a new relationship
- Grief and processing are handled through Safe Harbor (PRD-14), not First Mate

---

## AI Language Adaptation

### Pronoun Rules

The AI determines pronouns from two sources:
1. **The user's gender** (from `user_profiles.gender`) — for addressing the user
2. **The spouse/partner's gender** (inferred from context, or from their `people` record) — for referring to the partner

| User Gender | AI Uses for User |
|-------------|-----------------|
| male | he/him/his, "the man you're becoming", "husband" (if married) |
| female | she/her/hers, "the woman you're becoming", "wife" (if married) |
| non_binary | they/them/theirs, "the person you're becoming" |
| prefer_not_to_say / null | they/them/theirs, gender-neutral language throughout |

| Spouse Gender | AI Uses for Spouse |
|---------------|-------------------|
| Known male | he/him/his, "your husband" |
| Known female | she/her/hers, "your wife" |
| Unknown/neutral | they/them/theirs, "your spouse" or "your partner" |

### How Spouse Gender Is Determined

The AI does not ask the user to specify their spouse's gender as a form field. Instead:
- During First Mate onboarding, the AI asks "What's their name?" — pronoun usage often becomes clear from conversational context ("my husband Jake", "my wife Sarah")
- If unclear, the AI uses "your spouse" / "your partner" and they/them pronouns
- The user can clarify at any time naturally in conversation, and the AI adapts going forward
- If the user explicitly states pronouns ("she goes by she/her"), the AI locks that in

### Gendered Language Replacement Map

These replacements apply throughout all AI-generated content:

| Original (male user, female spouse) | Female user, male spouse | Gender-neutral |
|-------------------------------------|--------------------------|----------------|
| "become the husband you want to be" | "become the wife you want to be" | "become the partner you want to be" |
| "Ask her:" | "Ask him:" | "Ask them:" |
| "What makes her feel loved" | "What makes him feel loved" | "What makes them feel loved" |
| "your wife" | "your husband" | "your spouse" / "your partner" |
| "she told you she dreams about" | "he told you he dreams about" | "they told you they dream about" |
| "becoming a better husband" | "becoming a better wife" | "becoming a better partner" |
| "conjugial love between husband and wife" | "conjugial love between wife and husband" | "conjugial love between partners" |

### Single Users — AI Personality Adjustments

For single users, the AI:
- Focuses personal growth language on self-development and purpose: "the person you're becoming"
- Does not reference romantic relationships unless the user brings them up
- If the user discusses wanting a relationship, the AI engages supportively without pushing
- Redirects to appropriate growth frameworks: Mast (identity), Keel (self-knowledge), Wheel (change areas)
- Safe Harbor and Helm conversations about loneliness are valid and handled with care

### Dating/Courting Users — AI Personality Adjustments

For dating users, the AI:
- Uses "partner" instead of "spouse"
- Treats the relationship as meaningful but does not assume permanence
- Does not use marriage-specific frameworks (covenant language, conjugial love)
- Does reference healthy relationship principles (communication, appreciation, understanding)
- First Mate prompts are lighter: "What did you learn about them this week?" rather than deep intimacy probing
- No "Marriage Toolbox" label — instead "Relationship Growth Tools" with adapted modes

### Divorced/Widowed Users — AI Personality Adjustments

For divorced/widowed users, the AI:
- Does not bring up the former spouse unless the user initiates
- Treats grief and processing with Safe Harbor sensitivity
- If the user is in a new relationship, functions like Dating/Married as appropriate
- Focuses growth language on healing, renewal, and forward movement
- "The person you're becoming in this new chapter"

---

## PRD-Specific Modifications

### PRD-01: Auth & User Setup
- Add gender and relationship_status to onboarding flow (optional, can be skipped)
- Add both fields to Settings > Account section
- `handle_new_user()` trigger does not set defaults for these — they remain null until the user provides them

### PRD-02: The Mast
- Onboarding question adapts: "What kind of person are you choosing to become?" (not "man")
- Declaration language examples should include gender-neutral options alongside gendered ones
- Faith Foundations: sacred triangle adapts per relationship status (see table above)
- No structural changes to Mast data model

### PRD-04: The Helm
- AI system prompt includes user's gender and relationship_status for language adaptation
- Format in system prompt:
```
User Context:
- Name: [display_name]
- Gender: [gender or "not specified"]
- Relationship Status: [relationship_status or "not specified"]
```
- Helm guided modes that reference spouse (first_mate_action) only available if First Mate is active

### PRD-10: Reveille & Reckoning
- Greeting adapts: No gendered language in greetings (already mostly neutral)
- Spouse-related prompts only surface if First Mate is active

### PRD-11: Wheel & Life Inventory
- Spoke 4 (support people): If married, spouse is suggested. If single/dating, skip spouse suggestion.
- Life area "Spouse/Marriage" adapts:
  - Married: "Spouse/Marriage"
  - Dating: "Relationship"
  - Single: "Relationships" (broader, includes friendships and family)
  - Divorced/Widowed: "Relationships" (or "Relationship" if in new relationship)

### PRD-12: First Mate — Most Significant Changes

**Feature Name Adaptation:**
- Married: "First Mate" (spouse profile)
- Dating: "First Mate" (partner profile) — same name, adapted language
- Single: Feature hidden entirely
- Divorced/Widowed without new partner: Feature hidden

**Page Header Adaptation:**
- Married: "First Mate — [Spouse Name]"
- Dating: "First Mate — [Partner Name]"

**Prompt Button Labels:**
- "Ask Him" / "Ask Her" / "Ask Them" (based on partner gender)
- "Reflect" (unchanged — universal)
- "Express" (unchanged — universal)

**Category Labels:**
- "Their World" displayed as "His World" / "Her World" / "Their World" based on partner gender

**Marriage Toolbox → Relationship Toolbox (for dating users):**
- Quality Time: Available (date planning is universal)
- Gifts: Available
- Observe and Serve: Available but lighter framing ("what could you do for them?" not "service")
- Words of Affirmation: Available
- Gratitude: Available
- 21 Compliments Practice: Available for dating (with lighter framing)

**Sacred Triangle Integration:**
- Male married to female: "husband, wife, Lord" (original)
- Female married to male: "wife, husband, Lord"
- Any married: "[user role], [spouse role], Lord" — adapts to gender
- Dating with faith: "you, [partner name], and the Lord"
- No faith: Sacred triangle omitted entirely (already a rule)

**AI Prompt Examples — Adapted:**

Original (male user, female spouse):
- "What have you noticed about how your wife unwinds after a hard day?"

Female user, male spouse:
- "What have you noticed about how your husband unwinds after a hard day?"

Gender-neutral:
- "What have you noticed about how your partner unwinds after a hard day?"

Dating user:
- "What have you noticed about how [name] relaxes after a tough day?"

### PRD-13: Crew & Sphere of Influence

**Sphere Focus Center Adaptation:**
| Status | Focus Contains |
|--------|---------------|
| Married | Self, Spouse, God (if faith) |
| Dating | Self, God (if faith). Partner optionally in Focus or Family. |
| Single | Self, God (if faith) |
| Divorced/Widowed | Self, God (if faith) |

- "God" in Focus only if user has faith-related Mast entries. For secular users, Focus is Self only (married adds Spouse).
- Dating users can choose to place their partner in Focus sphere or Family sphere — not fixed like married users.

### PRD-14: Safe Harbor
- Crisis resources and safety protocols are gender-inclusive (already mostly neutral)
- Domestic violence resources should include resources for all genders
- "Tier 3 Safety Assessment" applies regardless of the user's gender

### PRD-17: Meeting Frameworks

**Couple Meeting:**
- Available for married and dating users
- Married: Full agenda as written, with language adapted per gender
- Dating: Adapted agenda — lighter commitment framing, no "covenant" language, no "state of the union" (renamed to "Check-In"), same basic structure
- Opening/closing prayer adapted to faith context as always

**Parent-Child Mentor Meeting:**
- Gender-neutral already ("parent" not "father")
- No changes needed

### PRD-18: Reminders & Rhythms
- Relationship nudges only surface if First Mate is active
- Sunday Reflection spiritual framing adapts to faith context (already supported)
- No gendered language in reminder templates

### PRD-19: Settings
- Add "Gender" field under Account section (dropdown: Male, Female, Non-binary, Prefer not to say)
- Add "Relationship Status" field under Account section (dropdown: Single, Dating/Courting, Married, Divorced/Widowed)
- Both editable at any time
- Changing relationship status triggers appropriate feature visibility updates immediately

---

## Onboarding Flow Adaptation

### Current Step 7: First Mate Setup (Optional)

**Modification:** This step only appears if `relationship_status` is 'married' or 'dating'. It is skipped entirely for single and divorced/widowed users (unless they're in a new relationship).

### New Onboarding Step (Early — After Display Name)

Add a light-touch identity step:

AI: "One quick thing that helps me communicate better with you — how would you like me to refer to you? This is totally optional."

1. "What are your pronouns?" → Options: He/Him, She/Her, They/Them, Skip
   - Maps to `gender`: he/him → male, she/her → female, they/them → non_binary, skip → null

2. "Are you currently in a relationship?" → Options: Single, Dating/Courting, Married, Divorced/Widowed, Skip
   - Maps to `relationship_status`, skip → null

AI: "Got it. You can always change this in Settings. Now let's set up your Mast..."

This step is **brief, optional, and non-invasive**. The user can skip both questions and the app functions perfectly with gender-neutral defaults.

---

## CLAUDE.md Additions from This Addendum

```
### User Flexibility (Gender & Relationship Status)
- AI reads `user_profiles.gender` and `user_profiles.relationship_status` to adapt language.
- If either is null, use gender-neutral language (they/them, "person", "partner").
- First Mate visibility: only if relationship_status is 'married' or 'dating'.
- Marriage Toolbox visibility: only if relationship_status is 'married'.
- Sphere Focus center: Self always. Spouse if married. God if faith Mast entries exist. Partner optional if dating.
- Pronoun adaptation: AI determines spouse/partner pronouns from conversational context, not a form field.
- Sacred triangle: adapts to [user role] + [partner role] + Lord. Omitted for secular users.
- Language rule: Never assume gender or relationship status. Adapt naturally when context is provided.
- Onboarding asks gender/relationship early (optional, skippable). First Mate step only shows for married/dating.
```

---

## DATABASE_SCHEMA.md Additions from This Addendum

```
-- Add to user_profiles table:
| gender | TEXT | null | NULL | Enum: 'male', 'female', 'non_binary', 'prefer_not_to_say'. Set during onboarding or Settings. |
| relationship_status | TEXT | null | NULL | Enum: 'single', 'dating', 'married', 'divorced', 'widowed'. Set during onboarding or Settings. |

-- Rename in spouse_insights:
-- category 'her_world' → 'their_world'

-- Rename in spouse_prompts:
-- prompt_type 'ask_her' → 'ask_them'
```

---

## System Overview Additions

Add to the Design Principles section:
- **Gender-inclusive by default:** All AI language adapts to the user's stated gender and relationship status. If unstated, defaults to gender-neutral. Features are shown/hidden based on relationship status.

Add to the Cross-Feature Rules:
- **Rule 10: Gender & Relationship Adaptive.** The AI adapts pronouns, feature visibility, and relationship framing based on `user_profiles.gender` and `user_profiles.relationship_status`. Null values default to inclusive/neutral. The user can change these at any time in Settings and the app adapts immediately.

---

*End of Addendum*
