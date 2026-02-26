# Vercel Environment Variables

Set these in Vercel Dashboard > Settings > Environment Variables.
All should be set for Production, Preview, and Development environments.

## Required — App won't work without these

| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_SUPABASE_URL` | Your Supabase project URL | `https://dkcyaklyqxhkhcnpdtwf.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon/public key (JWT format, starts with `eyJ...`) | From Supabase Dashboard > Settings > API > Project API keys |
| `VITE_VAPID_PUBLIC_KEY` | VAPID public key for push notifications | Generated during deployment prep |

## Required — Edge Functions need these (set in Supabase, NOT Vercel)

These are set via `npx supabase secrets set` and live in the Supabase Edge Function runtime:

| Secret | Description |
|--------|-------------|
| `OPENROUTER_API_KEY` | OpenRouter API key for AI chat and extraction |
| `OPENAI_API_KEY` | OpenAI API key for Whisper transcription and ada-002 embeddings |
| `VAPID_PUBLIC_KEY` | Same VAPID public key as above |
| `VAPID_PRIVATE_KEY` | VAPID private key (never expose in frontend!) |
| `VAPID_SUBJECT` | VAPID contact email (e.g., `mailto:admin@stewardship.app`) |

## Optional

| Variable | Description |
|----------|-------------|
| `VITE_SITE_URL` | Production URL (e.g., `https://stewardship.app`) — used for OpenRouter HTTP-Referer header |

---

## Supabase Dashboard Configuration

After deploying to Vercel, you also need to configure Supabase:

1. Go to **Supabase Dashboard > Authentication > URL Configuration**
2. Set **Site URL** to your Vercel production domain (e.g., `https://your-app.vercel.app`)
3. Add the Vercel domain to **Redirect URLs** (for auth callbacks):
   - `https://your-app.vercel.app/**`
   - If using a custom domain, add that too: `https://stewardship.app/**`

## Supabase Edge Function Deployment

Edge Functions must be deployed separately from the Vercel frontend:

```bash
# Link to your Supabase project (one-time)
npx supabase login
npx supabase link --project-ref dkcyaklyqxhkhcnpdtwf

# Set secrets (one-time, or when keys change)
npx supabase secrets set OPENROUTER_API_KEY=<your-key>
npx supabase secrets set OPENAI_API_KEY=<your-key>
npx supabase secrets set VAPID_PUBLIC_KEY=<your-key>
npx supabase secrets set VAPID_PRIVATE_KEY=<your-key>
npx supabase secrets set VAPID_SUBJECT=mailto:admin@stewardship.app

# Deploy all Edge Functions
npx supabase functions deploy

# Verify secrets are set
npx supabase secrets list
```

## Database Migrations

Ensure all migrations are applied before going live:

```bash
npx supabase db push --dry-run   # Check pending migrations
npx supabase db push              # Apply pending migrations
```

## Push Notification Note

The VAPID authentication is wired but Web Push payload encryption (RFC 8291 / aes128gcm) is not yet implemented in the `send-push` Edge Function. Push notification subscriptions and in-app notifications work correctly. Server-to-browser push delivery requires implementing the encryption layer or integrating a Deno-compatible web-push library. All other notification paths (Reveille batch, Reckoning batch, in-app alerts) work without push.
