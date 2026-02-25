# PRD-12A: Cyrano Me — First Mate Communication Coach

> An addition to PRD-12 (First Mate). Adds a guided mode that helps the user not just say kind things, but learn *why* certain words land and how to speak his wife's emotional language.

---

## The Problem

He wants to say something kind. He has the impulse — the feeling is real. But the words come out flat, generic, or focused on what *he* notices rather than what would make *her* feel truly seen. "You look nice" when what she needed to hear was "I noticed you handled that situation with the kids today with so much patience, and I just want you to know I see how hard you're working to be the mom you want to be."

The gap isn't love. The gap is *translation*.

---

## The Vision

**Cyrano Me** is a communication coach built into the First Mate page. The user brings a thought, a feeling, or even a clumsy first attempt — and the AI helps him craft something that will land in his wife's heart. But here's the key: **it doesn't just give him better words. It explains WHY those words are better.** It teaches him what she's actually listening for, what makes her feel seen versus just complimented, and how to connect his words to who she specifically is.

Over time, he's not just reading scripts. He's learning a skill. He's learning *her*.

---

## Amendment to PRD-12: Express Prompt Redesign

With the addition of Cyrano Me, the existing **Express** prompt button changes purpose. It no longer gives scripted words — it gives **action ideas** that require his own sincerity and thought.

**Old Express behavior:** "Text her: 'I was thinking about you today and I just wanted you to know you're my favorite person.'"

**New Express behavior:** Generates a *direction* — what to express and how — but leaves the actual words to him. Examples:

- "Text her a memory from when you were first dating that still makes you smile."
- "Tonight, tell her how her presence specifically improves one situation in your daily life."
- "Leave a note on her coffee cup about something she did this week that you're still thinking about."
- "Next time she's stressed, name the specific thing she's carrying that you see — don't try to fix it, just acknowledge it."
- "Think of something she does for the family that nobody ever thanks her for. Thank her for that one thing — out loud, not just in your head."
- "Send her a text right now about one way she's changed you for the better since you got married."

**Express prompts end with a soft Cyrano handoff:** "Need help putting it into words? Try Cyrano Me." This creates a natural funnel — Express sparks the idea, Cyrano helps craft the delivery when he wants it.

**The three prompts now form a clear progression:**
1. **Reflect** — Notice something about her (internal)
2. **Express** — Act on what you notice with an idea prompt (action, his own words)
3. **Cyrano Me** — Get help crafting the words and learn why they work (skill building)

This keeps Express sincere and considered. He has to think about what to say, which means whatever comes out is genuinely his — just pointed in the right direction.

**CLAUDE.md update:** Express prompts generate action ideas, not scripted words. Soft handoff to Cyrano Me when user wants help with wording.

---

## User Stories

- As a user, I want help turning my rough thoughts into words that will make my wife feel loved and seen.
- As a user, I want to understand WHY certain phrasings land better so I can learn to do this on my own.
- As a user, I want the AI to know enough about my wife that its suggestions are specific to her, not generic.
- As a user, I want to be able to send the final version directly (copy to clipboard, open in Messages) or save it for the right moment.
- As a user, I want to see my growth over time — how my "first drafts" are getting better.

---

## How It Works

### Entry Point

**A "Cyrano Me" button on the First Mate page**, positioned in the Marriage Toolbox section alongside the existing five modes (Quality Time, Gifts, Observe and Serve, Words of Affirmation, Gratitude). This becomes the sixth toolbox mode.

Icon suggestion: `Feather` (Lucide) — the quill. Nautical-adjacent, literary, perfect.

### The Flow

**Step 1: The Raw Thought**

User opens Cyrano Me. The AI greets warmly:

> "What are you feeling? Give me the raw version — doesn't have to be perfect. What do you want her to know?"

User types something like:
> "I just think she's been really great lately with how she handles everything"

**Step 2: The AI Asks Clarifying Questions**

The AI doesn't immediately rewrite. It digs for specificity:

> "That's a great starting point. Help me make this land for her — what specifically has she been handling? What did you actually see her do that made you think this?"

User responds:
> "She's been juggling the kids' schedules, her work stuff, and she still made time to help my mom with her doctor appointment"

**Step 3: The Crafted Version + The Teaching Moment**

The AI produces the upgraded version AND explains the craft:

> **Here's a version that might hit differently:**
>
> *"Hey — I've been watching you this week and I need you to know something. The way you managed [kid 1]'s practice schedule, kept your work deadlines, AND still drove my mom to her appointment on Thursday? That's not normal. Most people would have dropped something. You didn't drop anything, and you did all of it with grace. I see you. I see how hard you work to take care of everyone, and I don't want a single day to go by where you think I don't notice."*
>
> **Why this version works better for her:**
>
> **Specificity over generality.** "You've been great lately" is kind, but it doesn't prove you were paying attention. Naming the specific things — the practice schedule, the work deadlines, your mom's appointment — tells her "I was watching. I noticed the details." For someone whose love language is Words of Affirmation, being *seen in the specifics* is everything.
>
> **"That's not normal" reframes her effort.** She probably thinks everyone juggles like this. Naming it as exceptional helps her stop minimizing what she does.
>
> **"I don't want a single day to go by" creates urgency.** It tells her this isn't a casual observation — it's something you felt strongly enough to say out loud. That weight matters.
>
> **Ending with what you see, not what you want.** "I see you" is about HER. "You make my life easier" would have been about YOU. She needs to know she's seen as a person, not just appreciated as a function.

**Step 4: User Edits and Sends**

The user can:
- **Edit the text** — make it sound more like him (critical — it should be *his* voice, polished, not a script)
- **Ask for alternatives** — "Can you make it shorter?" / "Make it less intense" / "Add something about faith"
- **Copy to clipboard** — to paste into a text message
- **Open in Messages** — deep link to messaging app with text pre-filled
- **Save for later** — saves to a "Cyrano Drafts" section, accessible from First Mate page
- **Mark as sent** — logs it with timestamp. The AI remembers what he's said before to avoid repetition and build on previous messages.

**Step 5: The Skill Check (Optional, Periodic)**

After the user has used Cyrano Me several times (5+), the AI occasionally flips the script:

> "Want to try something? Write her something on your own first, and I'll give you feedback instead of a rewrite. You've been getting better at this — let's see where you are."

The user writes his attempt. The AI responds with:

> **Your version:** "I love how you always make sure everyone is taken care of."
>
> **What's strong:** You're acknowledging her caretaking nature, which she values. Good instinct.
>
> **What could land deeper:** Try naming ONE specific thing from today or this week instead of "always." "Always" feels like a general truth — a specific moment feels like proof you were present. Also, try telling her what it makes you *feel*, not just what you observe. "When I watched you [specific thing], I felt [your feeling]" is almost always more powerful than "I love how you [trait]."
>
> **Want me to show you a version, or want to take another crack at it yourself?**

This is the teaching loop. Over time, his first drafts get better. The AI notices and celebrates: *"Your instincts are getting really sharp. Six months ago you would have said 'you're amazing.' Today you wrote something that would make a poet jealous."*

---

## AI Behavior Rules

### Context the AI Uses
- **Full First Mate profile** — personality, love language, communication style, dreams, challenges, her world
- **Keel data** — the user's personality and communication style (to help bridge the gap between how he naturally expresses and how she naturally receives)
- **Past Cyrano messages** — to avoid repetition, build on themes, track growth
- **Recent Log/Helm entries** — if the user recently journaled about something relevant, the AI can suggest incorporating it
- **Mast principles** — if the user has declarations about the kind of husband he wants to be, the AI can connect the message to those values

### What the AI Never Does
- **Never writes something dishonest.** If the user's raw thought is about something that didn't happen, the AI doesn't embellish. It works with truth.
- **Never makes him dependent.** The teaching moments are the point. The AI actively works toward making itself unnecessary.
- **Never overwrites his voice.** The crafted version should sound like a better version of HIM, not like a Hallmark card. If the user is casual and funny, the crafted version should be casual and funny — just sharper.
- **Never repeats the same structural pattern.** Varies approach: sometimes a text, sometimes a note to leave on the counter, sometimes a thing to say face-to-face, sometimes a callback to a shared memory.
- **Never makes it performative.** The goal is connection, not impression. If the AI senses the user is trying to "win points" rather than genuinely connect, it gently redirects: *"This is good, but let me ask — is this what you actually feel, or what you think she wants to hear? Because she can tell the difference, and the real version is always better."*

### The Teaching Framework
Every Cyrano interaction teaches ONE of these skills:
1. **Specificity** — Name the thing, not the category
2. **Her lens, not his** — Express in her receiving language, not his expressing language
3. **Feeling over function** — What it makes him feel, not just what he observes
4. **Timing and context** — When and how to deliver for maximum impact
5. **Callback power** — Referencing shared history, inside jokes, previous conversations
6. **The unsaid need** — What she might need to hear that she'd never ask for
7. **Presence proof** — Words that demonstrate he was paying attention to something small

The AI rotates through these, with the teaching explanation highlighting which skill is being demonstrated. Over time, the user recognizes the patterns himself.

---

## Data Model

### New Fields (Optional)

**Option A: Use existing infrastructure**
- Cyrano messages saved as `spouse_insights` with `category = 'cyrano_draft'`
- Sent status tracked in the insight's `metadata` JSONB: `{ sent: true, sent_at: '...', raw_draft: '...', skill_focus: 'specificity' }`
- Past messages queryable from spouse_insights
- No new tables needed

**Option B: Dedicated tracking (if growth tracking matters)**
Add a `cyrano_messages` table:

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| user_id | UUID | FK → auth.users |
| raw_input | TEXT | What the user originally typed |
| crafted_version | TEXT | The AI's suggested version |
| final_version | TEXT | What the user actually sent (after their edits) |
| teaching_skill | TEXT | Which skill was highlighted (specificity, her_lens, feeling, timing, callback, unsaid, presence) |
| teaching_note | TEXT | The AI's explanation of why the changes matter |
| status | TEXT | 'draft', 'sent', 'saved_for_later' |
| sent_at | TIMESTAMPTZ | When marked as sent |
| created_at | TIMESTAMPTZ | |

This enables:
- Growth tracking: compare `raw_input` quality over time
- Repetition avoidance: AI checks past `crafted_version` and `final_version`
- Skill distribution: ensure all 7 skills get covered over time
- A really meaningful anniversary gift: export all the messages he's sent over the year

**Recommendation:** Start with Option A (zero migration needed, fits existing patterns). Move to Option B later if the growth tracking and export features are wanted.

---

## Guided Mode Integration

- `guided_mode = 'first_mate_action'`
- `guided_subtype = 'cyrano'`
- Loads: First Mate context, Keel context, Mast context, past Cyrano messages (last 10)
- Model: Sonnet (this needs nuance and emotional intelligence)

Add to the Marriage Toolbox section on the First Mate page as the sixth button.

---

## Screen: Cyrano Me Conversation

Opens the Helm in Cyrano guided mode. The conversation follows the flow described above (raw thought → clarifying questions → crafted version with teaching → edit/send).

The Helm input area adds two action buttons when in Cyrano mode:
- **Copy** — copies the most recent crafted/edited version to clipboard
- **Send** — opens the device's share sheet or Messages app with text pre-filled

These appear as small action chips below the AI's crafted message, similar to how "Save to Log" or "Create Task" appear on regular Helm messages.

---

## Screen: Cyrano Drafts (on First Mate page)

A collapsible section on the First Mate page (below Marriage Toolbox, above category sections):

```
Cyrano Drafts
├── "Saved for later" messages (most recent first)
│   ├── Preview of crafted text (truncated)
│   ├── Date saved
│   ├── "Send" / "Edit" / "Delete" actions
│   └── Tap to expand full message
└── "View Sent Messages" link → shows history with timestamps
```

If growth tracking is implemented (Option B), this section could also show:
- A subtle "growth indicator" — how many messages sent, which skills practiced
- The AI's periodic observation: *"You've sent 12 Cyrano messages. Your latest drafts are averaging 3x more specific than your first ones. She's a lucky woman."*

---

## What "Done" Looks Like

### MVP
- [ ] "Cyrano Me" button in Marriage Toolbox (sixth mode)
- [ ] Guided conversation flow: raw thought → clarifying questions → crafted version + teaching explanation
- [ ] Teaching explanations highlight one of 7 communication skills per interaction
- [ ] User can edit the crafted version
- [ ] Copy to clipboard action
- [ ] Save for later (stored as spouse_insight with cyrano_draft category)
- [ ] Sent messages logged with timestamp
- [ ] AI avoids repetition across past messages
- [ ] AI uses full First Mate + Keel context for personalization
- [ ] AI preserves user's natural voice (doesn't make him sound like someone else)

### Phase 2 (Enhancement)
- [ ] "Skill Check" mode — AI gives feedback on user's own drafts instead of rewriting
- [ ] Growth tracking — comparison of raw input quality over time
- [ ] Skill distribution tracking — ensure all 7 skills get practiced
- [ ] Cyrano Drafts section on First Mate page
- [ ] "Open in Messages" deep link
- [ ] Export sent messages (anniversary gift feature)

---

## CLAUDE.md Additions

- [ ] Cyrano Me: sixth Marriage Toolbox mode (`guided_subtype = 'cyrano'`). Communication coaching, not scripting. AI crafts + teaches one of 7 skills per interaction. Preserves user's voice. Uses full First Mate + Keel context. Tracks past messages to avoid repetition.
- [ ] Cyrano 7 skills: specificity, her_lens, feeling_over_function, timing, callback_power, unsaid_need, presence_proof
- [ ] Cyrano teaching loop: after 5+ uses, AI periodically offers "skill check" mode where user writes first draft and gets feedback instead of a rewrite

---

## DATABASE_SCHEMA Additions

**Option A (recommended for MVP):**
- Add `'cyrano_draft'` to `spouse_insights.category` enum
- Use `metadata` JSONB for sent status, raw draft, skill focus

**Option B (future):**
- `cyrano_messages` table as defined above

---

*End of PRD-12A*

*Now go let him add his finishing touches. He'll probably want to adjust the teaching skills list or add something about how she responds to humor. That's the whole point — he knows her better than any AI ever will. The AI just helps him say it.*
