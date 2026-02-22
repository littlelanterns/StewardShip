# PRD-01: Auth & User Setup

## Overview

This PRD covers user authentication, account creation, user profile, and the foundational data that every other feature depends on. This is the first thing that must work before any other feature can be built.

---

## User Stories

### Account Creation
- As a new user, I want to create an account with email and password so I can access the app.
- As a new user, after creating my account I want to be guided into the onboarding flow so I can set up my Mast, Keel, and first goals.

### Login
- As a returning user, I want to log in with my email and password so I can access my data.
- As a returning user, I want to stay logged in on my device so I don't have to log in every time I open the app.

### Password Management
- As a user, I want to reset my password via email if I forget it.
- As a user, I want to change my password from Settings.

### Profile
- As a user, I want to set my display name so the AI can greet me personally.
- As a user, I want to set my timezone so Reveille and Reckoning appear at the right times.

### Future: Social Login
- As a future user, I want to sign in with Google so I don't need a separate password.

---

## Screens

### Screen 1: Welcome / Landing

**What the user sees:**
- App name "StewardShip" with the nautical aesthetic
- Tagline or brief description
- Two buttons: "Create Account" and "Sign In"
- Clean, warm design matching the captain's quarters aesthetic

**Interactions:**
- Tap "Create Account" → goes to Screen 2
- Tap "Sign In" → goes to Screen 3

---

### Screen 2: Create Account

**What the user sees:**
- "Create Your Account" heading
- Fields: Display Name, Email, Password, Confirm Password
- "Create Account" button
- "Already have an account? Sign In" link

**Interactions:**
- User fills in all fields
- Tap "Create Account":
  - Validates: all fields required, email format valid, password minimum 8 characters, passwords match
  - On validation failure: inline error messages below the relevant field (red text, not a toast/popup)
  - On success: creates Supabase auth user, creates user profile record, redirects to Onboarding flow
  - On duplicate email: "An account with this email already exists. Sign in instead?"
- Tap "Sign In" link → goes to Screen 3

**Data created:**
- `auth.users` record (Supabase built-in)
- `user_profiles` record with: id, user_id, display_name, timezone (defaults to browser timezone), created_at, updated_at
- `user_settings` record with defaults (see Settings defaults below)

---

### Screen 3: Sign In

**What the user sees:**
- "Welcome Back" heading
- Fields: Email, Password
- "Sign In" button
- "Forgot Password?" link
- "Create an Account" link

**Interactions:**
- User fills in email and password
- Tap "Sign In":
  - On success: redirects to Crow's Nest (dashboard) or Reveille if it's morning and Reveille is enabled
  - On failure: "Invalid email or password. Please try again." (generic message for security — don't reveal whether email exists)
- Tap "Forgot Password?" → goes to Screen 4
- Tap "Create an Account" → goes to Screen 2

**Session persistence:**
- Supabase handles session tokens automatically
- Session persists across app closes and device restarts
- User stays logged in until they explicitly sign out or the refresh token expires

---

### Screen 4: Forgot Password

**What the user sees:**
- "Reset Your Password" heading
- Brief text: "Enter your email and we'll send you a reset link."
- Field: Email
- "Send Reset Link" button
- "Back to Sign In" link

**Interactions:**
- Tap "Send Reset Link":
  - Always shows: "If an account exists with this email, you'll receive a reset link." (don't reveal whether email exists)
  - Supabase sends password reset email
- User clicks link in email → Supabase handles redirect to password reset form
- After successful reset → redirect to Sign In

---

## Data Schema

### Table: `user_profiles`

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| id | UUID | gen_random_uuid() | Primary key |
| user_id | UUID | | Foreign key → auth.users. Unique. |
| display_name | TEXT | | User's preferred name for AI greetings |
| timezone | TEXT | 'America/Chicago' | IANA timezone string. Default set from browser on account creation. |
| onboarding_completed | BOOLEAN | false | Set true after onboarding flow finishes |
| created_at | TIMESTAMPTZ | now() | |
| updated_at | TIMESTAMPTZ | now() | Auto-updated via trigger |

**RLS Policy:** Users can only read/update their own profile. Insert on account creation only.

### Table: `user_settings`

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| id | UUID | gen_random_uuid() | Primary key |
| user_id | UUID | | Foreign key → auth.users. Unique. |
| ai_provider | TEXT | 'openrouter' | Enum: 'openrouter', 'gemini', 'openai' |
| ai_api_key_encrypted | TEXT | null | Encrypted API key. Null = use developer key. |
| ai_model | TEXT | 'anthropic/claude-sonnet' | Model string for selected provider |
| max_tokens | INTEGER | 1024 | System-level cap on AI response length |
| context_window_size | TEXT | 'medium' | Enum: 'short', 'medium', 'long' |
| reveille_enabled | BOOLEAN | true | Show morning briefing |
| reveille_time | TIME | '07:00' | When to trigger Reveille |
| reckoning_enabled | BOOLEAN | true | Show evening review |
| reckoning_time | TIME | '21:00' | When to trigger Reckoning |
| default_compass_view | TEXT | 'simple_list' | Enum: 'simple_list', 'eisenhower', 'eat_the_frog', 'one_three_nine', 'big_rocks', 'ivy_lee', 'by_category' |
| push_notifications_enabled | BOOLEAN | true | Master toggle for push notifications |
| gratitude_prompt_frequency | TEXT | 'daily' | Enum: 'daily', 'every_other_day', 'weekly', 'off' |
| joy_prompt_frequency | TEXT | 'every_few_days' | Enum: 'every_few_days', 'weekly', 'off' |
| anticipation_prompt_frequency | TEXT | 'weekly' | Enum: 'weekly', 'biweekly', 'off' |
| google_calendar_token | TEXT | null | OAuth token, encrypted. Post-launch. |
| created_at | TIMESTAMPTZ | now() | |
| updated_at | TIMESTAMPTZ | now() | |

**RLS Policy:** Users can only read/update their own settings.

**Note:** AI API keys must be encrypted before storage. Use Supabase Vault or application-level encryption via Edge Function. Keys are never sent to the frontend — all AI calls go through Edge Functions that decrypt server-side.

---

## Supabase Auth Configuration

### Providers (Initial)
- Email/password (enabled)
- Google OAuth (placeholder, post-launch)

### Email Templates
- **Confirmation email:** Customize with StewardShip branding and nautical tone. "Welcome aboard." (NEVER "Captain" — God is the Captain, the user is the steward.)
- **Password reset email:** Clean, simple, branded. "Reset your course."

### Session Settings
- Access token lifetime: 1 hour (Supabase default)
- Refresh token lifetime: 30 days (or longer — this is a personal app, long sessions are fine)
- Auto-refresh: enabled

---

## Auto-Created Records

When a new user is created in `auth.users`, a database trigger automatically creates:
1. A `user_profiles` record with display_name from signup form and timezone from browser
2. A `user_settings` record with all defaults

```sql
-- Trigger function: create profile and settings on new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (user_id, display_name, timezone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', 'Steward'),
    COALESCE(NEW.raw_user_meta_data->>'timezone', 'America/Chicago')
  );
  
  INSERT INTO public.user_settings (user_id)
  VALUES (NEW.id);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
```

---

## Edge Cases & Error States

### Network Errors
- If network is unavailable during account creation: "Unable to connect. Please check your internet connection and try again."
- If network drops during sign-in: same message
- All error messages appear inline, not as toasts or popups

### Email Already Exists
- On signup: "An account with this email already exists. Would you like to sign in instead?" with a link to Sign In.
- On forgot password: always show generic success message regardless of whether email exists

### Weak Password
- Minimum 8 characters
- Show requirements below password field before user types
- Validate in real-time as user types (green check when requirement met)

### Session Expiration
- If session expires while app is open: show a non-intrusive banner at top: "Your session has expired. Tap to sign in again."
- Tapping the banner opens Sign In screen
- Current page state is preserved if possible after re-auth

---

## What "Done" Looks Like

### MVP (Must Have for Launch)
- User can create account with email/password
- User can sign in and stay signed in
- User can reset password via email
- Profile record created with display name and timezone
- Settings record created with defaults
- RLS policies prevent cross-user data access
- Onboarding redirect works after account creation
- Sign-in redirects to Crow's Nest (or Reveille if morning)

### Post-Launch
- Google OAuth
- Change password from Settings
- Delete account from Settings
- Email verification enforcement
- Rate limiting on auth attempts

---

## Navigation After Auth

### Initial User (Birthday Gift)
The primary user will create his own account as part of the gift experience — the onboarding IS the gift. However, the developer needs a separate test account to verify features before the 18th. Both accounts use the same auth system.

- **Developer test account:** Created during development for testing. Can be deleted or kept.
- **Gift recipient account:** He creates it himself on the 18th. The onboarding flow is designed to feel like unwrapping the gift — discovering each feature as he sets it up.

### API Keys
- **Launch default:** Developer's OpenRouter API key, stored as an environment variable in Supabase Edge Functions. The user never sees it and doesn't need to configure anything. AI just works.
- **Settings option:** User can add their own API key in Settings at any time. If a user key is present, it is used instead of the developer key.
- **Key priority:** User key (if set) → Developer key (fallback)

```
New user creates account → Onboarding flow (PRD not yet written)
Returning user signs in → Crow's Nest dashboard
                          OR Reveille (if morning + enabled in settings)
                          OR Reckoning (if evening + enabled in settings)
User signs out → Welcome / Landing screen
```

---

## CLAUDE.md Additions from This PRD

_Items to add to CLAUDE.md:_

- [ ] `user_profiles` and `user_settings` table schemas
- [ ] Auto-creation trigger pattern for new users
- [ ] Convention: all error messages inline, not toasts
- [ ] Convention: security-conscious auth messaging (never reveal if email exists)
- [ ] Default timezone: 'America/Chicago' (user's actual location)
- [ ] AI API key encryption requirement

---

*End of PRD-01*
