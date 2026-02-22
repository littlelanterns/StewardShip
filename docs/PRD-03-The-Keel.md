# PRD-03: The Keel — Personality & Self-Knowledge

## Overview

The Keel is the deepest part of the ship — what the user is made of. It stores personality traits, tendencies, strengths, weaknesses, self-knowledge, and the "You, Inc." professional self-awareness profile. The Keel provides the AI with essential context about HOW the user thinks, processes, communicates, and relates to others.

Where The Mast defines who the user WANTS to become, The Keel describes who the user IS right now. Together they give the AI the full picture: current position and desired destination.

The Keel is deliberately flexible in input format. Some users will upload formal personality test PDFs. Others will describe themselves conversationally. Others will paste screenshots. The Keel accepts all of it.

---

## User Stories

### Viewing
- As a user, I want to see everything the app knows about my personality in one place.
- As a user, I want my self-knowledge organized by category so I can make sense of it.

### Adding — Multiple Input Methods
- As a user, I want to type a self-observation directly so I can capture an insight quickly.
- As a user, I want to upload a PDF of personality test results so the AI can reference them.
- As a user, I want to paste or describe my test results in a conversation so the AI can compile them.
- As a user, I want the AI to ask me questions about myself and compile what it learns into my Keel.

### Editing
- As a user, I want to edit anything in my Keel because self-knowledge evolves.
- As a user, I want to edit AI-compiled summaries because the AI might get something wrong about me.

### AI Integration
- As a user, I want the AI to reference my personality when giving advice so the advice fits ME, not a generic person.
- As a user, I want the AI to understand my communication style so it can help me navigate relationships better.
- As a user, I want the AI to understand my tendencies (both strengths and blind spots) so it can help me leverage strengths and watch for pitfalls.

---

## Screens

### Screen 1: Keel Main Page

**What the user sees:**
- Page title: "The Keel"
- Brief contextual line: "What you're made of."
- Entries organized by category, each collapsible:
  - **Personality Assessments** — formal test results (Enneagram, MBTI, Love Languages, StrengthsFinder, DISC, etc.)
  - **Traits & Tendencies** — self-observed patterns, habits, defaults
  - **Strengths** — what the user does well
  - **Growth Areas** — weaknesses, blind spots, areas being worked on (never labeled "weaknesses" in the UI — use "growth areas")
  - **You, Inc.** — professional self-awareness: unique value proposition, skills, what problems the user solves
  - **General Self-Knowledge** — anything that doesn't fit the above
- Each entry displayed as a card with:
  - Entry text (or summary for longer entries)
  - Source tag (self-observed, Enneagram, uploaded PDF, conversation, etc.)
  - Edit button
- "Add to Keel" button (floating action button)
- The Helm drawer accessible from this page

**Interactions:**
- Tap an entry card → expands to show full text plus edit/archive options
- Tap "Edit" → inline editor (same pattern as Mast PRD-02)
- Tap "Add to Keel" → opens Screen 2 (add new)
- Pull up Helm drawer → AI has Keel context loaded

---

### Screen 2: Add to Keel

**What the user sees:**
- Three clear options:
  - "Write it myself" — simple text form
  - "Upload a file" — PDF or image upload
  - "Discover at The Helm" — guided conversation

**Option A: Write It Myself**
- Text area for the entry
- Category selector: Personality Assessment, Trait/Tendency, Strength, Growth Area, You Inc., General
- Source field (optional, freeform — e.g., "Enneagram Type 1," "self-observed," "therapist feedback")
- "Save" button

**Option B: Upload a File**
- File picker (accepts PDF, PNG, JPG)
- After upload, AI processes the file:
  - For PDFs: extracts text, identifies key results, generates a structured summary
  - For images/screenshots: uses vision to read the content, generates summary
- AI presents the summary: "Here's what I found in your [Enneagram/MBTI/etc.] results: [summary]. Does this look right? Would you like to edit anything before saving?"
- User can edit the summary before saving
- Saved with source = 'uploaded_file' and the original file stored in Supabase Storage
- Category auto-suggested by AI based on content (user confirms)

**Option C: Discover at The Helm**
- Opens The Helm with a self-discovery prompt
- AI begins: "I'd like to understand you better. We can explore this a few ways — I can ask you about how you typically handle situations, or we can dig into specific areas like how you communicate, what motivates you, or how you handle conflict. Where would you like to start?"
- AI asks questions, listens, identifies patterns, and compiles findings
- After the conversation (or at natural pause points), AI offers: "Based on what you've shared, here's what I'm putting together about you: [compiled summary]. Does this feel accurate? Want to adjust anything?"
- User confirms → saved to Keel with source = 'helm_conversation'
- AI can spread this across multiple conversations — it doesn't need to be one session

---

### Screen 3: Edit Entry (Inline)

**What the user sees:**
- Entry card expands into editable text area
- Category selector dropdown
- Source field (editable)
- "Save" and "Cancel" buttons
- "Archive" button (muted)

**Interactions:**
- Same pattern as Mast editing (PRD-02)
- All AI-generated summaries are fully editable
- Archive uses soft delete (`archived_at` timestamp)

---

### Screen 4: Archived Entries

- Same pattern as Mast (PRD-02): list of archived entries with restore option

---

## Data Schema

### Table: `keel_entries`

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| id | UUID | gen_random_uuid() | Primary key |
| user_id | UUID | | Foreign key → auth.users |
| category | TEXT | | Enum: 'personality_assessment', 'trait_tendency', 'strength', 'growth_area', 'you_inc', 'general' |
| text | TEXT | | The entry content. Can be substantial for test result summaries. |
| source | TEXT | 'self_observed' | Freeform source label (e.g., 'Enneagram Type 1', 'MBTI - INTJ', 'therapist', 'self-observed', 'uploaded PDF', 'conversation') |
| source_type | TEXT | 'manual' | Enum: 'manual', 'uploaded_file', 'helm_conversation', 'manifest_extraction', 'log_routed' |
| source_reference_id | UUID | null | If from Manifest, Log, or uploaded file — the source ID |
| file_storage_path | TEXT | null | If an original file was uploaded, path in Supabase Storage |
| sort_order | INTEGER | 0 | Order within category group |
| archived_at | TIMESTAMPTZ | null | Null = active |
| created_at | TIMESTAMPTZ | now() | |
| updated_at | TIMESTAMPTZ | now() | |

**RLS Policy:** Users can only CRUD their own keel entries.

**Indexes:**
- `user_id, category, archived_at` (for grouped display)

---

## AI Behavior

### How the AI Uses the Keel

**Loaded when relevant:** Unlike the Mast (always loaded), the Keel is loaded into the AI context when personality context would improve the response. This includes:
- Relationship conversations (how the user communicates, attachment style, conflict tendencies)
- The Wheel Spoke 3 (self-inventory draws heavily from Keel)
- Safe Harbor (understanding the user's processing style during stress)
- Career/professional advice (You, Inc. data)
- Any conversation where the AI needs to tailor advice to the user's specific personality

**Format in system prompt:**

```
About the user (The Keel — who they are):

PERSONALITY ASSESSMENTS:
- [source]: [text]

TRAITS & TENDENCIES:
- [text]

STRENGTHS:
- [text]

GROWTH AREAS:
- [text]

PROFESSIONAL SELF-KNOWLEDGE (You, Inc.):
- [text]

GENERAL:
- [text]
```

**Tailored advice examples:**
- If Keel shows the user is an introvert who processes internally: AI gives space, doesn't push for immediate answers, suggests journaling before discussing
- If First Mate profile shows the spouse's love language is acts of service: AI suggests service-oriented gestures for relationship nudges, even if the user's own love language is something different. The point is to bridge the gap — the user naturally expresses love in their own language, but the spouse needs it in hers. The AI helps the user think in his spouse's language, not just his own.
- If Keel shows the user tends toward perfectionism: AI references the principle of not pursuing perfection, suggests "good enough" thresholds
- If Keel shows the user is a verbal processor: AI engages in longer back-and-forth rather than giving summarized advice

### 5 Levels of Consciousness Integration

The Keel is where the 5 Levels framework is applied to help the user understand themselves:

- **Level 1 (Actions):** "You mentioned you tend to withdraw during conflict. That's a Level 1 behavior — fully visible and controllable. What do you think is underneath it?"
- **Level 2 (Thoughts):** "The thought 'I'm going to make it worse if I say something' — that's driving the withdrawal. Can we examine whether that's always true?"
- **Level 3 (Feelings):** "It sounds like there's fear underneath — fear of saying the wrong thing. That's a Level 3 feeling, and feelings aren't controllable. But we can work with the thoughts and actions around it."
- **Level 4 (Context):** "This pattern of withdrawing has been with you a long time. That's a Level 4 context — it takes sustained, repeated action over time to shift. Be patient with yourself."
- **Level 5 (Unconscious):** "The fact that you're now noticing the withdrawal in real-time means you've brought something from Level 5 (unconscious) into awareness. That's significant progress."

The AI uses this framework to set realistic expectations and prevent discouragement. It never lectures about the levels — it applies them naturally when they help the user understand why change feels hard or why certain patterns persist.

### "You, Inc." (Thou Shall Prosper Integration)

When the user is working on professional self-knowledge, the AI can guide them through:
- "What is your unique value proposition? What problems do you solve that others can't?"
- "Who are your 'customers'? (boss, clients, family members who depend on your skills)"
- "What are your top 3 professional strengths, and how could you leverage them more?"
- "What's one skill that, if developed, would multiply the value of everything else you do?"

This positions the user as the steward of their professional gifts — responsible for developing and deploying them in service.

---

## Manifest-to-Keel Flow

When a user uploads content to The Manifest and selects "Inform The Keel" in the intake flow:

1. AI reads the uploaded content
2. AI identifies personality-relevant information (test results, self-assessments, trait descriptions)
3. AI presents findings: "I found personality insights in this material. Here's what I'd add to your Keel: [summary]. Does this look right?"
4. User edits if needed, confirms
5. AI suggests category → user confirms
6. Entry created with source_type = 'manifest_extraction'

---

## Log-to-Keel Flow

When a user captures something in The Log and routes it to the Keel:

1. User writes/captures entry (e.g., "I realized today that I always shut down when someone criticizes my work. It's not anger, it's shame.")
2. User selects "Save to Keel" from routing options
3. App suggests category (AI-assisted): "That sounds like a trait/tendency. Does that feel right?"
4. User confirms category → entry created with source_type = 'log_routed'
5. Original Log entry remains in Log

---

## Onboarding Integration

During onboarding (Step 4), the user sets up their initial Keel. This is lighter than The Mast setup — the AI is gathering context, not asking the user to declare principles.

1. "Tell me a bit about yourself. What kind of person are you? Not who you want to be — The Mast covers that. I mean who you are right now. How do you typically show up in the world?"
2. AI listens, asks follow-up questions, identifies traits
3. "Have you ever taken any personality assessments — Enneagram, Myers-Briggs, Love Languages, StrengthsFinder, anything like that? You can tell me your results, upload a file, or skip this for now."
4. AI compiles what it's learned: "Here's what I'm gathering about you so far: [summary]. Does this feel right?"
5. User confirms or adjusts → entries saved

The AI should emphasize: "This is just a starting point. Your Keel will deepen over time as we talk. I'll learn more about you with every conversation."

---

## Edge Cases

### Empty Keel
- The AI still functions without Keel data but gives less personalized advice
- Periodically suggest (gently, max once per week): "I could give you more tailored advice if I knew more about how you think and process. Want to spend a few minutes building out your Keel?"

### Very Large Uploaded Files
- PDFs are processed through the Manifest RAG pipeline (chunked and embedded)
- The Keel entry stores the AI-generated SUMMARY, not the full document text
- Original file stored in Supabase Storage for reference

### Contradictory Entries
- Users may have entries that seem contradictory ("I'm patient" and "I lose my temper easily")
- This is normal — people are complex. The AI does not flag contradictions as errors
- The AI can note nuance: "You've described yourself as generally patient but quick to anger when you feel disrespected. That's a useful distinction — it tells us the trigger isn't impatience in general, it's a specific situation."

### Sensitive Content
- Keel entries may contain sensitive self-knowledge (mental health details, trauma history, shame-related patterns)
- The AI treats all Keel content with care and never throws it back at the user judgmentally
- If Keel contains mental health information, the AI factors it in gently (e.g., if user notes anxiety, AI avoids high-pressure framing)

---

## What "Done" Looks Like

### MVP
- Keel page displays all active entries grouped by category
- User can add an entry directly (write it myself)
- User can edit any entry inline (including AI-generated content)
- User can archive and restore entries
- User can reorder within groups
- "Discover at The Helm" guided self-discovery conversation
- Onboarding Keel setup conversation
- Keel data loaded into AI context when personality-relevant
- AI applies 5 Levels of Consciousness naturally when relevant
- RLS prevents cross-user access

### MVP When Dependency Is Ready
- Upload a file (PDF/image) with AI summary extraction (requires file processing pipeline)
- Manifest-to-Keel extraction flow (requires The Manifest)
- Log-to-Keel routing (requires The Log routing system)

### Post-MVP
- "You, Inc." guided professional self-assessment at Helm
- AI recognizing Keel-relevant insights in ongoing conversations and offering to add them
- Visual personality profile summary card on Keel page

---

## CLAUDE.md Additions from This PRD

- [ ] Keel loaded into AI context selectively (when personality-relevant), not always like Mast
- [ ] 5 Levels of Consciousness: framework for AI to apply naturally, never lecture about
- [ ] Convention: "Growth Areas" never "Weaknesses" in UI labels
- [ ] Convention: AI-generated summaries of uploaded files — always user-editable before and after saving
- [ ] Sensitive content handling: Keel data treated with care, never used judgmentally
- [ ] File uploads: summary stored in entry, original file in Supabase Storage

---

*End of PRD-03*
