# PRD-12: First Mate — Spouse Profile & Relationship Growth

## Overview

First Mate is the spouse profile and relationship growth system. On a ship, your first mate is your partner in navigating — the person you rely on, plan with, and trust to keep things moving when you can't. In StewardShip, First Mate is where the user builds a deep, living understanding of their spouse so the AI can help them become the husband they want to be.

First Mate is not a contact card. It is a growing body of knowledge about the user's spouse — her personality, what makes her feel loved, how she communicates, what stresses her out, what her dreams are, what she needs from the marriage. This knowledge comes from many sources: the user's own observations, files and documents uploaded about her (personality assessments, love language details), conversations at The Helm, and her own responses to questions the user asks her in real life.

The First Mate page also serves as a gentle, ongoing prompt system. The AI periodically suggests things the user can do: questions to ask his spouse, things to reflect on about her, ways to express love in her language. These prompts are informed by what the AI already knows and what gaps remain.

For the initial user, First Mate reinforces the sacred triangle principle — that becoming a better husband and drawing closer to God are the same journey. Swedenborg's concept of conjugial love (the deepening spiritual union between husband and wife as both draw closer to the Lord) provides the theological foundation for how the AI frames relationship advice.

---

## User Stories

### Building the Profile
- As a user, I want to enter what I know about my wife so the AI can give me relationship advice that actually fits us.
- As a user, I want to upload her personality test results (PDFs, screenshots, text) so the AI understands how she's wired.
- As a user, I want to upload documents about her (love language details, communication preferences, etc.) so the AI has rich context.
- As a user, I want to talk about my wife at The Helm and have the AI offer to save relevant insights to her profile.
- As a user, I want the AI to auto-categorize what I add so I don't have to make organizational decisions.

### Viewing
- As a user, I want to see everything I know about my wife organized by category so I can quickly reference it.
- As a user, I want to see a summary of key facts at a glance (anniversary, personality shorthand, love language).
- As a user, I want to edit anything in her profile because my understanding of her deepens over time.

### Spouse Questions & Prompts
- As a user, I want the AI to suggest questions I can ask my wife so I can know her better.
- As a user, I want the AI to suggest things I should reflect on about my wife so I notice and appreciate her more.
- As a user, I want the AI to suggest specific actions I can take to express love in her language.
- As a user, I want to record her responses to questions so the AI can use that context going forward.
- As a user, I want to see past questions and responses so I can review what she's shared.

### AI Relationship Context
- As a user, I want the AI to reference what it knows about my wife when I'm processing a relationship issue at The Helm.
- As a user, I want the AI to notice patterns in how I talk about my marriage and gently reflect them back.
- As a user, I want the AI to connect my marriage growth to my spiritual growth when that connection is natural.

---

## Screens

### Screen 1: First Mate Main Page

**What the user sees:**

**Profile Header**
- Her name (display name)
- Key facts line beneath name: compact summary of known personality shorthand and love language (e.g., "ENFP / Type 3/2 / Acts of Service"). Only shows what's been entered — no blank placeholders.
- Anniversary date (if entered), with days-until-next if within 60 days
- "Edit Profile" text button to edit header fields directly

**Prompt Card (Prominent Position, Below Header)**
Three buttons the user can tap based on what they're in the mood for:
- **Ask Her** — generates a question to ask the spouse in real life
- **Reflect** — generates something for the user to observe or think about regarding his wife
- **Express** — generates a specific action to take (text her this, do this, say this)

The user taps the button they want, and the AI generates a prompt of that type. The prompt appears below the buttons with:
- The prompt text
- Prompt type indicator (subtle label matching which button was tapped)
- Action buttons: "Done — Record Response" (for Ask Her type), "Done" (for Reflect/Express), "Skip" (dismisses and lets user tap again)
- "Done — Record Response" opens a text area to enter what she said
- "Done" marks the prompt as acted on
- "Skip" dismisses the prompt — user can tap any button again for a new one
- "View Past Prompts" text link below the card

**Marriage Toolbox (Action Buttons, Below Prompt Card)**
A grouped section of five buttons, each opening a guided conversation at The Helm with First Mate context loaded. These are relationship action modes — specific ways the AI helps the user translate knowledge of his wife into meaningful action.

- **Quality Time** — Opens Helm in date-planning mode. AI uses spouse insights (her interests, love language, what she's stressed about, what she's mentioned wanting to do) to help brainstorm a date or shared experience meaningful to *her* specifically. Asks about budget, timing, logistics, childcare. Conversation can produce Compass tasks (make reservation, arrange babysitter, buy tickets, etc.).

- **Gifts** — Opens Helm in gift-planning mode. AI uses spouse insights (her interests, dreams, personality, things she's mentioned) to brainstorm a gift that connects to who she is. Can be for a specific occasion or "just because." Asks about budget. Conversation can produce Compass tasks (order gift, wrap it, write card, plan delivery, etc.).

- **Observe and Serve** — Opens Helm in service mode. AI helps the user identify ways to serve her that would actually land — based on her love language, what she's been dealing with, what she needs right now. Connects noticing to action: "What have you observed about her week? What would lighten her load?" The AI also nudges awareness of things the user might be overlooking: things she's mentioned repeatedly that are frustrating her, things she's asked for that he may be putting off, or recurring needs he hasn't acted on. Not generic acts of service but specific to her current reality. Conversation can produce Compass tasks.

- **Words of Affirmation** — Opens Helm in affirmation mode. AI draws from the full First Mate profile — her personality, strengths, dreams, challenges, what she does for the family — and from gratitude entries to help the user see why specific things about his wife are incredible. The AI helps him realize and articulate what he sees in her: not surface-level compliments but words that reflect her character, her effort, and who she is. Could produce: a written note to give her, a text to send, a declaration to speak. Can save insights to First Mate as observations. Can produce Compass tasks (write the note, send the text, etc.).

  **21 Compliments Practice:** A specific structured option within Words of Affirmation. The AI guides the user through generating 21 thoughtful, specific compliments about his wife through conversation — asking questions, drawing from her profile, helping him see things he might take for granted. The number defaults to 21 (based on therapeutic recommendation: 3 per day for a week) but the user can choose a different number. All generated compliments are fully editable — the user should put them into his own words, add nuance, adjust details. Once finalized, the compliments are saved as a List (PRD-06, type 'compliments') so the user can check them off as he delivers them throughout the week via any method he chooses (spoken, texted, written note, etc.).

- **Gratitude** — Two modes:
  - *Quick capture:* A simple text entry that saves a spouse-specific gratitude note. No conversation needed — just "What are you grateful for about her today?" with a text field and save button. Saves to BOTH the Log (tagged with 'marriage' life area, entry_type 'gratitude') AND spouse_insights (category 'gratitude'). Entries accumulate over time. Occasionally, when an entry has depth potential (touches on character or identity rather than surface observation), the AI offers: "That's a rich one. Want to explore what's underneath that?" This is optional and infrequent — most of the time, quick capture stays quick.
  - *Go deeper:* Opens Helm in spouse-gratitude mode. AI helps the user explore what he's grateful for and why — connecting gratitude to her character, to their history, to who she is becoming. Deeper entries also save to both Log and spouse_insights.

**Guided Mode Behavior:**
- All five modes set `guided_mode = 'first_mate_action'` on the Helm conversation with a `guided_subtype` indicating which action (date, gift, serve, compliment, gratitude)
- AI has full First Mate context + Keel loaded for relationship dynamics
- At conversation end, AI offers: "Want me to add any of this to your Compass?" and lists suggested tasks
- User confirms which tasks to create → tasks created in `compass_tasks` with life_area = 'spouse_marriage'
- Any spouse-relevant insights from the conversation are offered for save to `spouse_insights` (same Helm-to-First-Mate flow)

---

**Category Sections (Scrollable Below Ways to Love Her)**
Collapsible sections, each showing the insights in that category. Sections only appear when they have content. Default categories:
  - **Personality & Wiring** — assessment results, type indicators, how she processes
  - **Love & Appreciation** — love languages, what makes her feel loved, meaningful compliments, what she values
  - **Communication** — how she communicates, conflict style, what helps her feel heard
  - **Dreams & Goals** — her aspirations, things she's excited about, what she wants for the future
  - **Challenges & Needs** — what stresses her, insecurities, what she needs support with
  - **Her World** — interests, hobbies, favorites, things she enjoys
  - **Gratitude** — things he's grateful for about her (from quick capture and deeper conversations)
  - **Observations** — things the user has noticed or reflected on about her
  - **Her Responses** — what she's said in response to spouse questions

Each insight within a section shows:
  - Content text (truncated if long, tappable to expand)
  - Source indicator: "uploaded," "conversation," "your observation," "her response," etc.
  - Date added
  - Edit button

**Add Button (Floating Action)**
- "Add to First Mate" — opens Screen 2

**Helm Drawer**
- Accessible from this page. When pulled up, AI loads full First Mate context plus Keel (user's personality) for relationship dynamics advice.

---

### Screen 2: Add to First Mate

**What the user sees:**
Three options (same pattern as Keel PRD-03):

**Option A: Write It Myself**
- Text area for the insight
- Category auto-suggested by AI after entry, shown as a chip the user can change
- Source field (optional freeform — e.g., "she told me," "I noticed," "her mom mentioned")
- "Save" button

**Option B: Upload a File**
- File picker (accepts PDF, PNG, JPG, .md, .txt)
- After upload, AI processes the file:
  - For PDFs and text files: extracts content, identifies key insights, generates categorized summaries
  - For images/screenshots: uses vision to read the content, generates summary
- AI presents the extracted insights as individual items: "I found several things in this file. Here's how I'd organize them: [list with suggested categories]. Does this look right? Edit anything before saving."
- User can edit summaries and categories before saving
- A single file may produce multiple `spouse_insights` entries across different categories
- Original file stored in Supabase Storage

**Option C: Discuss at The Helm**
- Opens The Helm with First Mate context
- AI begins: "Tell me about your wife. What's on your mind — or is there something specific about her you want me to know?"
- AI listens, asks follow-up questions, identifies insight-worthy information
- At natural pause points: "Based on what you've shared, here are some things I'd like to save to your First Mate profile: [list]. Do these look right?"
- User confirms → saved as individual entries with source_type = 'helm_conversation'

---

### Screen 3: Edit Insight (Inline)

- Same pattern as Keel editing (PRD-03): card expands into editable text area
- Category selector (can change AI's auto-assignment)
- Source field (editable)
- "Save" and "Cancel" buttons
- "Archive" button (soft delete)

---

### Screen 4: Past Prompts

**What the user sees:**
- Reverse chronological list of past prompts
- Each shows: prompt text, type, date, status (acted on / skipped), and response text (if recorded)
- Tappable to expand and see full response
- Her responses are also saved as insights in the "Her Responses" category section on the main page, so they're searchable and part of AI context

---

## Data Schema

### Table: `people`

This table is shared between First Mate (PRD-12) and Crew (PRD-13). First Mate-specific fields are noted.

| Column | Type | Default | Nullable | Notes |
|--------|------|---------|----------|-------|
| id | UUID | gen_random_uuid() | NOT NULL | PK |
| user_id | UUID | | NOT NULL | FK → auth.users |
| name | TEXT | | NOT NULL | Display name |
| relationship_type | TEXT | | NOT NULL | Enum: 'spouse', 'child', 'parent', 'sibling', 'coworker', 'friend', 'mentor', 'other' |
| is_first_mate | BOOLEAN | false | NOT NULL | Only one person can be true per user |
| categories | TEXT[] | '{}' | NOT NULL | Array: 'immediate_family', 'extended_family', 'professional', 'social', 'church_community', 'custom' |
| notes | TEXT | null | NULL | General freeform notes |
| age | INTEGER | null | NULL | Optional, relevant for children |
| personality_summary | TEXT | null | NULL | AI-compiled personality shorthand (e.g., "ENFP / Type 3/2 / Acts of Service") |
| love_language | TEXT | null | NULL | Primary love language if known |
| important_dates | JSONB | null | NULL | Array of {label, date, recurring} (e.g., {label: "Anniversary", date: "2008-06-14", recurring: true}) |
| archived_at | TIMESTAMPTZ | null | NULL | Soft delete |
| created_at | TIMESTAMPTZ | now() | NOT NULL | |
| updated_at | TIMESTAMPTZ | now() | NOT NULL | Auto-trigger |

**RLS:** Users CRUD own people only.
**Indexes:**
- `user_id, is_first_mate` (quick First Mate lookup)
- `user_id, relationship_type, archived_at` (filtered views)
- `user_id, archived_at` (active people list)

**Constraint:** Maximum one `is_first_mate = true` per `user_id` (enforced via partial unique index).

---

### Table: `spouse_insights`

Stores all knowledge about the spouse from any source. Each record is one categorized insight.

| Column | Type | Default | Nullable | Notes |
|--------|------|---------|----------|-------|
| id | UUID | gen_random_uuid() | NOT NULL | PK |
| user_id | UUID | | NOT NULL | FK → auth.users |
| person_id | UUID | | NOT NULL | FK → people (the First Mate) |
| category | TEXT | | NOT NULL | Enum: 'personality', 'love_appreciation', 'communication', 'dreams_goals', 'challenges_needs', 'her_world', 'observation', 'her_response', 'gratitude', 'general' |
| text | TEXT | | NOT NULL | The insight content |
| source_type | TEXT | 'manual' | NOT NULL | Enum: 'manual', 'uploaded_file', 'helm_conversation', 'spouse_prompt', 'log_routed' |
| source_label | TEXT | null | NULL | Freeform label (e.g., "Gallup StrengthsFinder", "she told me", "I noticed at dinner") |
| source_reference_id | UUID | null | NULL | FK → source record if applicable |
| file_storage_path | TEXT | null | NULL | If from uploaded file, path in Supabase Storage |
| is_rag_indexed | BOOLEAN | false | NOT NULL | True if content was too large for direct context and was sent to Manifest RAG |
| archived_at | TIMESTAMPTZ | null | NULL | Soft delete |
| created_at | TIMESTAMPTZ | now() | NOT NULL | |
| updated_at | TIMESTAMPTZ | now() | NOT NULL | Auto-trigger |

**RLS:** Users CRUD own insights only.
**Indexes:**
- `user_id, person_id, category, archived_at` (category grouping on page)
- `user_id, person_id, archived_at` (all active insights)
- `user_id, person_id, source_type` (filter by source)

---

### Table: `spouse_prompts`

Stores the AI-generated prompts (questions, reflections, actions) and user responses.

| Column | Type | Default | Nullable | Notes |
|--------|------|---------|----------|-------|
| id | UUID | gen_random_uuid() | NOT NULL | PK |
| user_id | UUID | | NOT NULL | FK → auth.users |
| person_id | UUID | | NOT NULL | FK → people (the First Mate) |
| prompt_type | TEXT | | NOT NULL | Enum: 'ask_her', 'reflect', 'express' |
| prompt_text | TEXT | | NOT NULL | The AI-generated prompt |
| status | TEXT | 'pending' | NOT NULL | Enum: 'pending', 'acted_on', 'skipped' |
| response_text | TEXT | null | NULL | What she said (for ask_her) or what the user observed/did (for reflect/express) |
| response_saved_as_insight | BOOLEAN | false | NOT NULL | Whether the response was also saved to spouse_insights |
| insight_id | UUID | null | NULL | FK → spouse_insights if response was saved |
| generation_context | TEXT | null | NULL | Why the AI generated this prompt (gap-filling, contextual, etc.) — for AI learning, not shown to user |
| created_at | TIMESTAMPTZ | now() | NOT NULL | |
| acted_on_at | TIMESTAMPTZ | null | NULL | When the user marked it done |

**RLS:** Users access own prompts only.
**Indexes:**
- `user_id, person_id, status` (current pending prompt)
- `user_id, person_id, created_at DESC` (prompt history)

---

## AI Behavior

### Love Languages: All Five Matter

While the AI prioritizes the spouse's primary love language when making suggestions, it also encourages the user to express love across all five languages. A person may prefer Acts of Service, but still needs to hear words of affirmation, still values quality time, still appreciates a thoughtful gift, and still needs physical affection. The AI should vary its suggestions and occasionally nudge outside the primary language: "Her primary language is acts of service, but when was the last time you just told her what you see in her?"

### How the AI Uses First Mate Context

**Loaded when relevant:** First Mate context is loaded into the AI system prompt when:
- The user is on the First Mate page (always)
- The conversation touches on marriage, spouse, relationship, or family dynamics
- The user mentions their wife by name
- Safe Harbor conversations that involve relationship stress
- Wheel building where the Hub relates to marriage/relationship
- Meeting Frameworks: Couple Meeting

**Format in system prompt:**

```
About the user's spouse — First Mate ([name]):

PERSONALITY & WIRING:
- [insight text] (source: [source_label])

LOVE & APPRECIATION:
- [insight text]

COMMUNICATION:
- [insight text]

DREAMS & GOALS:
- [insight text]

CHALLENGES & NEEDS:
- [insight text]

KEY FACTS:
- Love language: [if known]
- Anniversary: [if known]
- Personality shorthand: [if known]

RECENT SPOUSE PROMPT RESPONSES:
- Asked: "[prompt text]" → She said: "[response text]" ([date])
```

### Prompt Generation Logic

The AI generates one prompt at a time. When the current prompt is acted on or skipped, a new one is generated. The AI considers:

**Gap-filling:** What categories have the least data? If "Dreams & Goals" is empty, generate a question that explores that. If "Communication" has nothing, suggest an observation prompt about how she communicates.

**Contextually relevant:** What's happening in the user's life right now? If recent Helm conversations or Log entries mention communication struggles, lean toward prompts about understanding her communication style. If the user just had a victory in the "Marriage" life area, suggest an expression of gratitude to her.

**Variety:** Rotate between prompt types (ask_her, reflect, express) so the experience doesn't feel repetitive. Track what types have been generated recently and vary.

**Depth over breadth:** As the profile grows, prompts should go deeper rather than wider. Early prompts fill in basics ("What's her love language?"). Later prompts push toward intimacy ("What's something your wife is afraid of that she hasn't told many people?").

**Example prompts by type:**

Ask Her:
- "Ask her: 'What's one thing I do that makes you feel most seen?'"
- "Ask her: 'What's something you've been thinking about lately that you haven't brought up?'"
- "Ask her: 'If you could change one thing about how we spend our weekends, what would it be?'"

Reflect:
- "What have you noticed about how your wife unwinds after a hard day? What does she actually do, not what you think she should do?"
- "Think about the last time your wife seemed really happy. What was happening? What role did you play?"
- "What's something your wife does for the family that you've never specifically told her you appreciate?"

Express:
- "Her love language is acts of service. What's one thing you could do today that she'd notice — without being asked?"
- "You mentioned she's been stressed about [X]. Send her a text today that acknowledges that without trying to fix it."
- "She told you she dreams about [Y]. Bring it up tonight — ask her what the first step would be."

### Sacred Triangle Integration (Initial User)

For the initial user, relationship advice is framed through the sacred triangle: husband, wife, Lord. Drawing closer to either spouse or God draws you closer to the other.

- When discussing marriage: "How does this connect to your covenant with her and with the Lord?"
- When celebrating relationship growth: "This is what conjugial love looks like in practice — two people choosing to grow toward each other and toward God at the same time."
- When the user is frustrated: "Have you taken this to the Lord? And have you asked her how she sees this?"

The AI never forces this framing. It applies when the conversation naturally touches on spiritual dimensions of marriage, or when the user's Mast principles include marriage-related declarations.

For future multi-user support: this framing adapts to whatever faith context the user has defined on their Mast, or is omitted entirely for secular users.

### Pattern Recognition (No Visible Tracker)

The AI notices relationship patterns across Helm conversations, Log entries, and First Mate data over time. It reflects these in conversation when the user is in a receptive context — not as unsolicited commentary, but when the user is processing something related.

Examples:
- "I've noticed that the last three times you've mentioned feeling disconnected from your wife, it's been during weeks where work consumed most of your energy. Do you see that pattern?"
- "You've recorded several victories in the Marriage category this month. Something shifted — do you know what it was?"
- "The last few questions you've asked her have been about her dreams and goals. She seems to be opening up more in her responses. That's worth noticing."

The AI never assigns a score, rating, or health indicator. It observes and reflects. The user draws their own conclusions.

### Relationship Safety (Three-Tier)

Consistent with the AIMfM Faith & Ethics Framework:

**Tier 1: Capacity Building** — For normal relationship challenges. The AI helps build capacity: communication tools, talking points, perspective-taking, empathy exercises. Most interactions fall here.

**Tier 2: Professional Support** — For complex or entrenched patterns. The AI helps prepare for therapy (question lists, topic organization) and encourages professional help. AI does not attempt to be a therapist.

**Tier 3: Safety Assessment** — If red flags appear (fear of partner, control, isolation, escalation), the AI provides safety resources immediately. NO "work on the relationship" advice. No communication strategies (which can backfire with abusers). Crisis Override (Cross-Feature Rule 8) applies.

---

## Cross-Feature Connections

### → Reminders + Rhythms (PRD-18)
First Mate provides the data that makes relationship nudges meaningful. This PRD defines what the AI knows; PRD-18 defines when and how nudges are delivered.

**What feeds into nudges:**
- Love language → nudge content tailored to her language
- Important dates → date-based reminders (anniversary, birthday)
- Recent prompt responses → follow-up suggestions
- Personality data → communication-appropriate nudge framing
- Spouse insights → contextually relevant suggestions

**Nudge in Reveille/Reckoning:**
- Occasionally, the current spouse prompt is surfaced in Reveille ("Your First Mate question for today: [prompt]") or Reckoning ("Did you get a chance to ask your wife about [prompt]?").
- Frequency: not every day. Configurable in Settings (PRD-19). Default: 2-3 times per week.

### → Meeting Frameworks: Couple Meeting (PRD-17)
First Mate data feeds into the Couple Meeting agenda. This PRD defines the data; PRD-17 defines the meeting structure.

**What feeds into Couple Meeting:**
- Recent spouse prompt responses (topics to discuss further)
- Active spouse insights (context for meeting conversation)
- Life Inventory: Marriage/Partnership area (current state and vision)
- Recent Helm conversations tagged with marriage context

### → The Wheel: Spoke 4 (Defined in PRD-11)
Spouse role boundaries already defined:
- Spouse CAN be a Supporter (cheerleader, no judgment)
- Spouse NEVER a Reminder (don't give spouse permission to nag about the change)
- Spouse NEVER an Observer (but spouse can share observations WITH the Observer)
- AI drafts conversation scripts for each role. If spouse is Supporter, the script respects these boundaries.

### → Sphere of Influence (PRD-13)
Spouse is permanently fixed in the Focus sphere (center). This is set automatically when `is_first_mate = true` and cannot be moved. Defined here, implemented in PRD-13.

### → Life Inventory
Marriage/Partnership is a default life area. First Mate data enriches AI context when discussing this area. When the Life Inventory is updated in the Marriage area, the AI may reference spouse insights for a richer perspective.

### → The Keel
The Keel (user's personality) + First Mate (spouse's personality) together give the AI the relationship dynamics picture. When loaded together, the AI can identify complementary strengths, potential friction points, and communication bridge strategies.

---

## Helm-to-First-Mate Flow

When the user is talking at The Helm and mentions something about their spouse:

1. AI identifies spouse-relevant information in the conversation
2. AI asks: "That's a good insight about [wife's name]. Would you like me to save that to your First Mate profile?"
3. User confirms → AI auto-categorizes and saves to `spouse_insights` with source_type = 'helm_conversation'
4. User can also say no — the insight stays in the conversation but isn't saved to the profile

This should feel natural, not interruptive. The AI doesn't ask after every mention of the spouse — only when something substantive and worth saving emerges.

---

## Log-to-First-Mate Flow

When a user captures something in The Log that relates to their spouse:

1. User writes a Log entry (e.g., "Had a great talk with [wife] tonight. She told me she's been feeling overwhelmed by the kids' schedules and wishes we had more couple time.")
2. Routing options include "Save to First Mate"
3. If selected, AI extracts the spouse-relevant insight and suggests a category
4. User confirms → saved to `spouse_insights` with source_type = 'log_routed'
5. Original Log entry remains in The Log

---

## Onboarding Integration

During onboarding (Step 7 — optional), the user can set up the First Mate profile.

The AI guides with a light touch:
1. "Would you like to tell me about your wife? This helps me give you better relationship advice. You can also skip this and come back anytime."
2. If yes: "What's her name?" → saved to `people` record
3. "What's your anniversary?" → saved to `important_dates`
4. "Do you know her love language? Or how she most likes to receive love?" → saved
5. "What's one thing about her personality that's important for me to know?" → saved to `spouse_insights`
6. "If you have any files about her personality or preferences — test results, notes, anything — you can upload those anytime from the First Mate page."

Emphasize: "This grows over time. The more I know about your wife, the better I can help you become the husband you want to be."

---

## Edge Cases

### No Spouse Set Up
- If no person has `is_first_mate = true`, the First Mate page shows a setup prompt: "Set up your First Mate profile to get personalized relationship advice."
- The AI still functions for all other features. Relationship-related features simply don't have spouse context.
- The AI does not nag about setting up First Mate. It can mention it once if the user discusses marriage at The Helm: "I could give you more tailored advice if you set up your First Mate profile. Want to do that now, or keep talking?"

### Unmarried Future Users
- The `is_first_mate` field and the First Mate page are available to any user who wants to set up a spouse/partner profile.
- For users without a spouse, the page simply doesn't appear in navigation (or appears with setup prompt).
- Future consideration: adapt for dating relationships, but that's out of scope for now.

### Sensitive Spouse Information
- The AI treats all spouse insights with care. Information about her insecurities, challenges, or fears is used to help the user be more empathetic and supportive — never weaponized or brought up inappropriately.
- If the user seems to be using spouse information in a controlling or manipulative way, Tier 2 or Tier 3 safety protocols apply.

### Contradictory Information
- Same as Keel: people are complex. If one insight says "she loves surprises" and another says "she gets anxious about unexpected changes," the AI navigates the nuance: "She seems to love surprises in some contexts but needs predictability in others. What's the difference?"

### Very Large Uploaded Files
- Small/medium files: content extracted into `spouse_insights` entries as direct AI context
- Large files (e.g., a lengthy personality report): content sent to Manifest RAG pipeline, `is_rag_indexed` set to true on the insight record. AI retrieves relevant passages via similarity search when needed.
- Threshold: if extracted text exceeds ~3000 tokens, use RAG. Otherwise, direct context.

### Prompt When No Data Exists
- If First Mate is set up but has minimal data, prompts focus on foundational knowledge: love language, communication style, basic personality. Gap-filling mode.
- If substantial data exists, prompts shift toward deeper intimacy and contextual relevance.

### Deleted or Archived First Mate
- If the user archives the First Mate person record, all spouse insights and prompts remain in the database but stop being loaded into AI context.
- The First Mate page shows the setup prompt again.
- Restoring the person record re-activates everything.

---

## What "Done" Looks Like

### MVP
- First Mate page with profile header, prompt card, Marriage Toolbox section, category sections, and add button
- Add insight: write it myself (text entry with AI auto-categorization)
- Add insight: discuss at The Helm (guided conversation with save offers)
- Edit and archive insights
- Spouse prompt system: three user-initiated buttons (Ask Her, Reflect, Express) generating prompts on demand
- Act on / skip prompts, record responses
- Past prompts view
- Responses auto-saved as insights in "Her Responses" category
- Five guided conversation modes (Marriage Toolbox): Quality Time, Gifts, Observe and Serve, Words of Affirmation, Gratitude
- 21 Compliments Practice within Words of Affirmation (default 21, user adjustable, editable, saved as List)
- Gratitude: quick capture (text entry, dual save to Log + spouse_insights) and deeper Helm conversation
- All guided modes can produce Compass tasks (user confirms)
- First Mate context loaded into Helm system prompt when relationship-relevant
- Keel + First Mate loaded together for relationship dynamics
- Sacred triangle framing for initial user (adaptive for future users)
- Onboarding Step 7: optional First Mate setup
- RLS on all tables

### MVP When Dependency Is Ready
- Upload a file (PDF/image/.md/.txt) with AI extraction into categorized insights (requires file processing pipeline)
- Log-to-First-Mate routing (requires Log routing system from PRD-05)
- Spouse prompts surfaced in Reveille/Reckoning (requires PRD-10 integration point)
- Relationship nudge data feeding into Reminders (requires PRD-18)
- Couple Meeting context (requires PRD-17)
- Large file RAG fallback (requires Manifest RAG pipeline from PRD-15)

### Post-MVP
- AI pattern recognition reflected in conversation (requires accumulated data over time)
- Smart prompt scheduling (AI determines optimal timing for prompts based on user patterns)
- Relationship growth narrative (periodic AI-generated summary of how the relationship context has deepened, similar to Victory Review)
- Spouse personality comparison view (side-by-side with Keel, showing complementary and friction areas)

---

## CLAUDE.md Additions from This PRD

- [ ] First Mate context loaded into AI selectively (when relationship-relevant), not always like Mast
- [ ] Keel + First Mate loaded together for relationship dynamics conversations
- [ ] Sacred triangle framing: becoming a better husband = drawing closer to God. Applied when natural, never forced. Adapts to user's faith context.
- [ ] Conjugial love concept (Swedenborg): deepening spiritual union as both draw closer to Lord. For initial user only unless future user's Mast includes similar principles.
- [ ] Spouse prompt system: one at a time, three types (ask_her, reflect, express), mix of gap-filling and contextual
- [ ] Helm-to-First-Mate flow: AI offers to save spouse-relevant insights from conversation. Not after every mention — only substantive insights.
- [ ] Relationship safety: three-tier (capacity building, professional referral, crisis override). Consistent with Faith Ethics Framework.
- [ ] Pattern recognition in conversation only — no visible tracker or health score on the page
- [ ] File uploads: small/medium → direct context as `spouse_insights`, large → Manifest RAG fallback
- [ ] Convention: AI auto-categorizes spouse insights on save, user can adjust (same pattern as Log tagging)
- [ ] Convention: spouse personality data used to help user express love in HER language, not just his own
- [ ] Five guided conversation modes ("Marriage Toolbox"): Quality Time, Gifts, Observe and Serve, Words of Affirmation, Gratitude
- [ ] Guided modes use `guided_mode = 'first_mate_action'` on helm_conversations
- [ ] All guided modes can produce Compass tasks (user confirms which ones to create)
- [ ] Gratitude saves to BOTH Log (marriage life area, gratitude type) AND spouse_insights (gratitude category)
- [ ] Words of Affirmation draws from full First Mate profile AND gratitude entries to help user see and articulate what's incredible about his wife
- [ ] 21 Compliments Practice: structured option in Words of Affirmation, default 21 (user adjustable), all editable, saved as List for delivery tracking
- [ ] Love languages: AI prioritizes spouse's primary language but encourages expressions across all five. Vary suggestions, nudge outside primary.
- [ ] Prompt card: user-initiated via three buttons (Ask Her / Reflect / Express), not AI-randomly-generated
- [ ] Observe and Serve: AI nudges awareness of repeated frustrations, put-off requests, and overlooked needs — not just nice-to-do service
- [ ] Quick capture gratitude: no conversation needed, simple text entry, dual save. AI occasionally offers to go deeper when entry has depth potential.

---

## DATABASE_SCHEMA Additions from This PRD

Tables defined: `people`, `spouse_insights`, `spouse_prompts`

Update `helm_conversations.guided_mode` enum to include: `'first_mate_action'`
Add column to `helm_conversations`: `guided_subtype` TEXT (nullable) — for sub-modes like 'quality_time', 'gifts', 'observe_serve', 'words_of_affirmation', 'gratitude' within first_mate_action guided mode.

Update "Tables Not Yet Defined" section:
- ~~people | PRD-12/13~~ → DONE (PRD-12, shared with PRD-13)
- spouse_insights | PRD-12 | DONE
- spouse_prompts | PRD-12 | DONE

---

*End of PRD-12*
