# PRD-19: Settings — Configuration Panel

## Overview

Settings is the control room of StewardShip. On a ship, the captain's quarters hold the instruments that calibrate navigation, communication, and crew operations. Settings serves the same role — it's where the user configures how StewardShip works for them.

Settings is unique among the PRDs: it introduces no new features. Instead, it provides a unified interface for configuring behaviors that are defined and implemented across every other PRD. The `user_profiles` and `user_settings` tables (PRD-01) are already fully defined with columns accumulated from PRDs 01 through 18. This PRD defines the Settings *page* — its organization, sections, controls, and UX.

The guiding principle: **Settings should be discoverable but not overwhelming.** Most users should never need to visit Settings because the defaults are sensible. But when they do visit, every option should be clearly explained, easy to change, and immediately effective.

---

## User Stories

### Account
- As a user, I want to change my display name so the AI greets me correctly.
- As a user, I want to update my timezone when I travel.
- As a user, I want to change my password.
- As a user, I want to delete my account and all my data.

### AI Configuration
- As a user, I want to use the default AI provider without configuring anything.
- As a user, I want to add my own API key if I prefer to use my own account.
- As a user, I want to choose my AI model (within the selected provider).
- As a user, I want to control how much context the AI loads so I can manage cost.

### Daily Rhythms
- As a user, I want to enable or disable Reveille and Reckoning.
- As a user, I want to set what time Reveille and Reckoning appear.
- As a user, I want to control how often gratitude, joy, and anticipation prompts appear.
- As a user, I want to configure my Mast thought rotation frequency.

### Notifications
- As a user, I want a master toggle to turn off all push notifications.
- As a user, I want to control which types of reminders I receive and how they're delivered.
- As a user, I want to set quiet hours so I'm not disturbed at night.

### Rhythms
- As a user, I want to enable or disable Friday Overview and Sunday Reflection.
- As a user, I want to choose what day and time weekly rhythms trigger.
- As a user, I want to control Monthly and Quarterly review prompts.

### Meetings
- As a user, I want to manage my meeting schedules from one place.

### Display
- As a user, I want to choose my default Compass view.

### Data
- As a user, I want to export my data.
- As a user, I want to set up monthly journal export reminders.

---

## Screen: Settings Page

Settings is a single page with collapsible sections. Each section groups related settings logically. The page scrolls vertically. Sections are collapsed by default except the one the user navigated to (if they arrived via a deep link from another feature).

### Navigation Access
- Settings is accessible from the sidebar/hamburger menu (always visible)
- Settings gear icon in the Crow's Nest header
- Deep links from other features (e.g., "Notification Settings" from a reminder, "Meeting Schedules" from Meeting Frameworks)

---

### Section 1: Account

**Header:** "Account"
**Description:** "Your profile and authentication."

| Setting | Control | Maps to | Notes |
|---------|---------|---------|-------|
| Display Name | Text input | `user_profiles.display_name` | Used in AI greetings, Reveille, Reckoning |
| Email | Display only (not editable here) | `auth.users.email` | Shows current email. "Change email" links to Supabase auth flow |
| Timezone | Dropdown (IANA timezones, searchable) | `user_profiles.timezone` | Default: 'America/Chicago'. Affects all time-based features |
| Change Password | Button → auth flow | Supabase auth | Opens password change flow |
| Delete Account | Button → confirmation flow | Cascading delete | Two-step confirmation: "Are you sure?" → "Type DELETE to confirm" → account and all data permanently removed |

**Delete Account flow:**
1. User taps "Delete Account"
2. Warning screen: "This will permanently delete your account and ALL your data — conversations, journal entries, goals, plans, everything. This cannot be undone."
3. Text input: "Type DELETE to confirm"
4. Final button: "Permanently Delete My Account"
5. On confirm: Supabase cascade delete on auth.users removes all related records via FK constraints
6. User is signed out and returned to the welcome screen

---

### Section 2: AI Configuration

**Header:** "AI Assistant"
**Description:** "Configure how the AI works. The defaults work well for most people."

| Setting | Control | Maps to | Notes |
|---------|---------|---------|-------|
| AI Provider | Dropdown: OpenRouter, Gemini, OpenAI | `user_settings.ai_provider` | Default: 'openrouter' |
| API Key | Password input + "Save" button | `user_settings.ai_api_key_encrypted` | Placeholder: "Using developer key (no setup needed)". If user enters a key, it's encrypted and stored. "Clear" button to revert to developer key. |
| AI Model | Dropdown (populated based on provider) | `user_settings.ai_model` | Default: 'anthropic/claude-sonnet'. Options change per provider. |
| Response Length | Slider or dropdown: Short / Medium / Long | `user_settings.max_tokens` | Short = 512, Medium = 1024 (default), Long = 2048. Shown as friendly labels, not token counts. |
| Context Depth | Dropdown: Light / Standard / Deep | `user_settings.context_window_size` | Light (~4K), Standard (~8K, default), Deep (~16K). Affects how much background info AI loads per conversation. Tooltip: "Deeper context gives better advice but uses more tokens." |

**Helper text below section:** "Don't know what these mean? The defaults work great. You only need to change these if you have your own AI API key or want to adjust AI response behavior."

---

### Section 3: Daily Rhythms

**Header:** "Daily Rhythms"
**Description:** "Configure your morning and evening experiences."

**Subsection: Reveille (Morning)**

| Setting | Control | Maps to | Notes |
|---------|---------|---------|-------|
| Enable Reveille | Toggle | `user_settings.reveille_enabled` | Default: on. If off, app opens directly to Crow's Nest in the morning. |
| Reveille Time | Time picker | `user_settings.reveille_time` | Default: 7:00 AM. Reveille shows between this time and noon. |
| Morning Thought Rotation | Dropdown: Every app open / Daily / Weekly / Manual | `user_settings.mast_thought_rotation` | Default: Daily. "Manual" reveals a "Pin a Mast Entry" selector. |
| Pinned Mast Entry | Mast entry selector (only visible when rotation = Manual) | `user_settings.mast_thought_pinned_id` | Select from user's Mast entries |
| Morning Reading Sources | Multi-select checkboxes: Mast / Manifest / Log | `user_settings.morning_reading_sources` | Default: all three enabled. At least one must be selected. |

**Subsection: Reckoning (Evening)**

| Setting | Control | Maps to | Notes |
|---------|---------|---------|-------|
| Enable Reckoning | Toggle | `user_settings.reckoning_enabled` | Default: on. If off, no evening review appears. |
| Reckoning Time | Time picker | `user_settings.reckoning_time` | Default: 9:00 PM. Reckoning shows between this time and midnight. |

**Subsection: Prompted Entries**

| Setting | Control | Maps to | Notes |
|---------|---------|---------|-------|
| Gratitude Prompts | Dropdown: Daily / Every other day / Weekly / Off | `user_settings.gratitude_prompt_frequency` | Default: Daily. Shown in Reckoning. |
| Joy/Wonder Prompts | Dropdown: Every few days / Weekly / Off | `user_settings.joy_prompt_frequency` | Default: Every few days. |
| Anticipation Prompts | Dropdown: Weekly / Biweekly / Off | `user_settings.anticipation_prompt_frequency` | Default: Weekly. |

---

### Section 4: Notifications

**Header:** "Notifications"
**Description:** "Control how and when StewardShip reaches out to you."

**Subsection: Push Notifications**

| Setting | Control | Maps to | Notes |
|---------|---------|---------|-------|
| Push Notifications | Master toggle | `user_settings.push_notifications_enabled` | Default: on. When off, NO push notifications sent. All reminders fall back to Reveille/Reckoning. |
| Push Permission Status | Status indicator (read-only) | Browser Push API | Shows: "Enabled ✓", "Not set up — Enable", or "Blocked in browser settings". If not set up, "Enable" button triggers browser permission prompt. |
| Quiet Hours Start | Time picker | `user_settings.quiet_hours_start` | Default: 10:00 PM. No push during quiet hours. |
| Quiet Hours End | Time picker or "Same as Reveille time" toggle | `user_settings.quiet_hours_end` | Default: null (uses reveille_time). |
| Daily Push Limit | Number input (1-20) | `user_settings.max_daily_push` | Default: 5. Excess reminders batched to Reveille. |

**Subsection: Delivery Preferences**

Shown as a compact table of toggles:

| Category | Options | Default | Maps to |
|----------|---------|---------|---------|
| Tasks (due/overdue) | Reveille / Push / Off | Reveille | `notification_tasks` |
| Meetings (due/day-before) | Reveille / Push / Both / Off | Reveille | `notification_meetings` |
| People (dates, spouse prompts) | Push / Reveille / Off | Push | `notification_people` |
| Growth (Wheel, Rigging) | Reveille / Off | Reveille | `notification_growth` |
| Streaks (at-risk) | Reckoning / Off | Reckoning | `notification_streaks` |
| Rhythms (Fri/Sun/Monthly/Qtr) | Push / In-app only / Off | Push | `notification_rhythms` |
| Custom reminders | Push / Reveille | Push | `notification_custom` |

**Subsection: Important Dates**

| Setting | Control | Maps to | Notes |
|---------|---------|---------|-------|
| Advance Notice | Dropdown: Day of only / 1 day before / 3 days before / 1 week before | `user_settings.important_dates_advance_days` | Default: 1 day before. Applies to all First Mate + Crew important dates. |

---

### Section 5: Weekly & Periodic Rhythms

**Header:** "Rhythms"
**Description:** "Weekly, monthly, and quarterly reflection cadences."

| Setting | Control | Maps to | Notes |
|---------|---------|---------|-------|
| Friday Overview | Toggle | `user_settings.friday_overview_enabled` | Default: on |
| Friday Overview Day | Dropdown (days of week) | `user_settings.friday_overview_day` | Default: Friday. User can move to another day if preferred. |
| Friday Overview Time | Time picker | `user_settings.friday_overview_time` | Default: 5:00 PM |
| Sunday Reflection | Toggle | `user_settings.sunday_reflection_enabled` | Default: on |
| Sunday Reflection Day | Dropdown (days of week) | `user_settings.sunday_reflection_day` | Default: Sunday |
| Sunday Reflection Time | Time picker | `user_settings.sunday_reflection_time` | Default: 7:00 PM |
| Monthly Review Prompt | Toggle | `user_settings.monthly_review_enabled` | Default: on |
| Monthly Review Day | Number input (1-28) | `user_settings.monthly_review_day` | Default: 1st of month |
| Quarterly Inventory Prompt | Toggle | `user_settings.quarterly_inventory_enabled` | Default: on. Timing is always ~90 days since last Life Inventory. |
| Journal Export Reminder | Toggle | `user_settings.journal_export_reminder` | Default: off. If on, reminder on 1st of each month. |

---

### Section 6: Meeting Schedules

**Header:** "Meeting Schedules"
**Description:** "Manage your recurring meeting cadences."

This section embeds the Meeting Schedules view from PRD-17 (Screen 4) directly within Settings. It is the same data — `meeting_schedules` table — just accessible from Settings as well as from the Meeting Frameworks page.

One row per scheduled meeting:

| Meeting | Frequency | Day/Time | Notifications | Actions |
|---------|-----------|----------|---------------|---------|
| Couple Meeting | Weekly | Sunday 8:00 PM | Reveille | Edit / Pause / Delete |
| Mentor: Jake | Bi-weekly | Saturday 10:00 AM | Reveille | Edit / Pause / Delete |
| Weekly Review | Weekly | Sunday 6:00 PM | Reveille | Edit / Pause / Delete |
| ... | ... | ... | ... | ... |

"Add Meeting Schedule" button → opens meeting schedule creation (same as PRD-17).

**Note:** This section simply surfaces existing meeting_schedules data. No new tables or columns.

---

### Section 7: Compass

**Header:** "Compass Preferences"
**Description:** "Customize your task management experience."

| Setting | Control | Maps to | Notes |
|---------|---------|---------|-------|
| Default View | Dropdown: Simple List / Eisenhower Matrix / Eat the Frog / 1-3-9 / Big Rocks / Ivy Lee / By Category | `user_settings.default_compass_view` | Default: Simple List. The view that loads when the user opens The Compass. |

---

### Section 8: Data & Privacy

**Header:** "Data & Privacy"
**Description:** "Your data belongs to you."

| Setting | Control | Notes |
|---------|---------|-------|
| Export All Data | Button → generates download | Exports all user data as a ZIP file containing JSON files per table. Not real-time — generates in background, download link sent when ready. |
| Export Journal | Button → opens Log export screen | Links to the Printable Journal Export feature (PRD-05 / Build Order #29). |
| Data Storage Info | Display text | "Your data is stored securely on Supabase servers. All AI conversations are processed through your selected AI provider. StewardShip does not sell or share your data." |

**Export All Data flow:**
1. User taps "Export All Data"
2. Confirmation: "This will generate a complete export of all your StewardShip data as a ZIP file. This may take a few minutes."
3. Background job creates JSON files: user_profiles, user_settings, mast_entries, keel_entries, helm_conversations, helm_messages, log_entries, compass_tasks, lists, list_items, goals, custom_trackers, tracker_entries, victories, wheel_instances (and all spoke/rim tables), life_inventory_areas, life_inventory_snapshots, people, spouse_insights, spouse_prompts, crew_notes, sphere_entities, manifest_items, ai_frameworks, ai_framework_principles, rigging_plans, rigging_milestones, rigging_obstacles, meetings, meeting_schedules, meeting_templates, reminders, daily_rhythm_status
4. ZIP file available for download
5. Download link expires after 24 hours

---

### Section 9: About

**Header:** "About StewardShip"

| Item | Content |
|------|---------|
| Version | App version number (from package.json) |
| Built with | "Built with love, faith, and a lot of late nights." |
| Acknowledgments | Link to an acknowledgments page listing philosophical sources: Stephen Covey, Nicholeen Peck, Oliver DeMille, Rabbi Daniel Lapin, and other influences. No long text here — just a clean list. |
| Feedback | "Have feedback? Tap here to send a note." → Opens email to developer's email address |
| Privacy Policy | Link to privacy policy page |
| Terms of Service | Link to terms page |

---

## Data Schema

### No New Tables

Settings creates **no new tables**. All settings are stored in the existing `user_profiles` and `user_settings` tables defined in PRD-01 with columns added by PRD-10 and PRD-18.

The `meeting_schedules` table (PRD-17) is surfaced here but not created by this PRD.

### Columns Already Defined

For reference, the complete `user_settings` column inventory as of PRD-18:

**AI Configuration (PRD-01):**
- ai_provider, ai_api_key_encrypted, ai_model, max_tokens, context_window_size

**Daily Rhythms (PRD-01/10):**
- reveille_enabled, reveille_time, reckoning_enabled, reckoning_time
- gratitude_prompt_frequency, joy_prompt_frequency, anticipation_prompt_frequency
- mast_thought_rotation, mast_thought_pinned_id, morning_reading_sources

**Compass (PRD-06):**
- default_compass_view

**Notifications (PRD-01/18):**
- push_notifications_enabled
- quiet_hours_start, quiet_hours_end, max_daily_push
- notification_tasks, notification_meetings, notification_people, notification_growth, notification_streaks, notification_rhythms, notification_custom
- important_dates_advance_days

**Rhythms (PRD-18):**
- friday_overview_enabled, friday_overview_time, friday_overview_day
- sunday_reflection_enabled, sunday_reflection_time, sunday_reflection_day
- monthly_review_enabled, monthly_review_day
- quarterly_inventory_enabled

**Data (PRD-05):**
- journal_export_reminder

**Post-launch:**
- google_calendar_token

---

## UX Design Principles

### Progressive Disclosure
Settings uses collapsible sections. Users only see the categories, not every toggle at once. This prevents overwhelm.

### Smart Defaults
Every setting has a sensible default that works for 90%+ of users. The app is fully functional without ever visiting Settings.

### Immediate Effect
All setting changes take effect immediately — no "Save" button needed for individual toggles and dropdowns. The app uses optimistic updates with periodic sync.

### Contextual Access
Settings sections can be deep-linked from other features:
- "Notification Settings" link from a reminder → opens Section 4 (Notifications) expanded
- "Meeting Schedules" from Meeting Frameworks → opens Section 6 expanded
- "Change timezone" from Reveille timing issue → opens Section 1 expanded
- "Adjust context depth" from AI cost notice → opens Section 2 expanded

### No Jargon
Settings labels use plain language:
- "Response Length" not "max_tokens"
- "Context Depth" not "context_window_size"
- "Light / Standard / Deep" not "4K / 8K / 16K"

Where technical concepts are unavoidable, a tooltip or helper text explains them.

---

## Cross-Feature Connections

Settings is read by virtually every feature in the app. Rather than listing every reader, here are the key relationships:

### → Reveille / Reckoning (PRD-10)
Reveille/Reckoning check: enabled, time, prompt frequencies, morning reading sources, mast thought rotation

### → Reminders (PRD-18)
Reminders engine checks: push_notifications_enabled, quiet hours, per-type delivery preferences, max_daily_push, important_dates_advance_days

### → Rhythms (PRD-18)
Rhythm triggers check: friday/sunday/monthly/quarterly enabled, times, days

### → The Helm (PRD-04)
AI configuration: provider, model, max_tokens, context_window_size

### → The Compass (PRD-06)
Default view on page load: default_compass_view

### → Meeting Frameworks (PRD-17)
Meeting schedules surfaced in Settings Section 6. Schedule changes propagate to Reminders.

### → The Log (PRD-05)
Journal export reminder toggle

---

## Edge Cases

### First Visit
When the user opens Settings for the first time:
- All sections collapsed with brief descriptions
- No tutorial or walkthrough — the section headers are self-explanatory
- "Recommended for you" badge on any section where the default might not match the user (e.g., timezone detection suggests a different timezone than the default)

### Timezone Change
When the user changes their timezone:
- All time-based features immediately recalculate: Reveille/Reckoning windows, reminder delivery times, meeting schedules, rhythm triggers
- Confirmation text: "Timezone updated to [timezone]. All your schedules and reminders now use this timezone."

### API Key Validation
When the user enters an API key:
- "Test Connection" button sends a minimal API call to verify the key works
- Success: "Connected ✓" with green indicator
- Failure: "Connection failed. Check your key and try again." with red indicator
- Key is only saved after successful test

### Delete Account
This is an irreversible, high-stakes action. The two-step confirmation (warning + type "DELETE") is intentionally friction-heavy to prevent accidental deletion.

After deletion:
- All user data removed (cascade delete on auth.users)
- Push subscriptions invalidated
- User signed out
- No recovery possible — this is communicated clearly in the warning

### Offline
Settings changes made while offline are queued and synced when connectivity returns. The UI shows the new values immediately (optimistic) with a subtle "syncing..." indicator.

---

## What "Done" Looks Like

### MVP
- Settings page with 9 collapsible sections
- Section 1: Account (display name, timezone, change password, delete account)
- Section 2: AI Configuration (provider, API key with test, model, response length, context depth)
- Section 3: Daily Rhythms (Reveille/Reckoning enable/time, prompts, Mast thought rotation)
- Section 4: Notifications (master toggle, push permission status, quiet hours, per-type delivery, important dates advance notice)
- Section 5: Rhythms (Friday/Sunday/Monthly/Quarterly enable/time/day)
- Section 6: Meeting Schedules (embedded from PRD-17, read/write meeting_schedules)
- Section 7: Compass (default view)
- Section 8: Data & Privacy (export all data, export journal, data storage info)
- Section 9: About (version, acknowledgments, feedback, privacy/terms)
- Deep linking from other features to specific Settings sections
- Immediate effect for all changes (no global Save button)
- API key encryption and test connection
- Delete account with two-step confirmation
- Data export as ZIP of JSON files
- All Settings reads from `user_profiles` + `user_settings` — no new tables

### Post-MVP
- Theme / appearance settings (dark mode, font size, color accent)
- Google Calendar integration setup (OAuth flow, sync preferences)
- AI usage dashboard (tokens used this month, cost estimate if using own key)
- Backup and restore (import a previously exported ZIP)
- Multi-device sync settings
- Accessibility options (screen reader hints, reduced motion, high contrast)

---

## CLAUDE.md Additions from This PRD

- [ ] Settings is the configuration panel — no new tables, no new features. It surfaces controls for `user_profiles` and `user_settings` columns defined across PRDs 01-18, plus meeting_schedules from PRD-17.
- [ ] Nine sections: Account, AI Configuration, Daily Rhythms, Notifications, Rhythms, Meeting Schedules, Compass, Data & Privacy, About.
- [ ] All settings use plain language labels (not column names or token counts). Progressive disclosure via collapsible sections.
- [ ] Deep linking: other features can link directly to a specific Settings section (e.g., "Notification Settings" from a reminder).
- [ ] All changes take immediate effect — no global Save button. Optimistic updates with sync.
- [ ] Delete account: irreversible, two-step confirmation (warning + type "DELETE"). Cascade delete removes all data.
- [ ] API key: encrypted storage, test connection before saving, "Clear" to revert to developer key.
- [ ] Data export: ZIP of JSON files per table, background generation, 24-hour download link.

---

## DATABASE_SCHEMA Additions from This PRD

No tables added. No columns added. Settings surfaces existing data only.

Update "Tables Not Yet Defined" section:
- No changes (no remaining PRD-19 tables were expected)

---

*End of PRD-19*
