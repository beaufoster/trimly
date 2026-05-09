# Trimly — Project Brief

## What It Is
A progressive web app (PWA) that calculates personalised weight loss plans and tracks weekly progress. Users enter their stats, get a projected timeline with milestones, and log weekly weigh-ins to compare actual vs. projected progress.

**Live URL:** https://beaufoster.github.io/trimly  
**Repo:** github.com/beaufoster/trimly  
**Owner email:** beaudfoster@gmail.com

---

## Tech Stack
- **Frontend:** Vanilla JS (ES modules), HTML, CSS — no framework
- **Build:** Vite 6
- **Database & Auth:** Supabase (PostgreSQL + magic link auth)
- **Analytics:** PostHog (consent-gated, GDPR-compliant)
- **Hosting:** GitHub Pages, auto-deployed via GitHub Actions on push to `main`
- **Key deps:** `@supabase/supabase-js`, `posthog-js`
- **Testing:** Vitest (unit), Playwright (e2e)

---

## File Structure
```
index.html              — entire app UI (single HTML file)
src/js/app.js           — all application logic (~1500 lines)
src/js/supabase.js      — Supabase client init (reads env vars)
src/js/utils.js         — shared utility functions
src/css/styles.css      — all styles (~450 lines)
public/privacy.html     — privacy policy page (served at /trimly/privacy.html)
vite.config.js          — base: '/trimly/' in prod, '/' in dev
playwright.config.js    — Playwright e2e config
tests/unit/core.test.js — vitest unit tests
tests/e2e/app.spec.js   — Playwright e2e tests
.github/workflows/deploy.yml — CI/CD to GitHub Pages
supabase_schema.sql     — reference SQL for DB tables
```

---

## Supabase Database Schema
```sql
-- User check-ins (one per week per user)
checkins: id, user_id (FK auth.users), date, weight (lbs), note, app_id, created_at
  UNIQUE (user_id, date)

-- User calculator plan (one row per user)
-- data jsonb includes: cw, gw, age, htFt, htIn, htCm, sex, cal, act, walk, lift, cardio, pace, mode, goalDate, sim, name
user_plans: user_id (PK), data (jsonb), updated_at

-- Email leads from "Save My Plan" modal (no auth required)
leads: id, name, email, plan_mode, checkin_count, created_at
```
All tables have RLS enabled. `checkins` and `user_plans` use `auth.uid() = user_id`. `leads` allows anonymous inserts only.

---

## Core Features

### Calculator (page 1)
- Inputs: current weight, goal weight, age, sex, height, activity level
- Sliders: daily calories, walking, lifting, cardio (minutes/week)
- Two modes: **Goal Weight** (calculates weeks to goal) or **Target Date** (calculates projected weight by date)
- Three pace presets: Gentle (≤0.5 lb/wk), Steady (0.5–1), Aggressive (1–2)
- Occasion chips (Wedding, Vacation, etc.) for date mode
- Live BMR/TDEE calculation using Mifflin-St Jeor
- Projection chart (SVG) and milestone timeline
- Progress snapshot showing actual vs. projected when check-ins exist
- Plateau detection (flags if weight unchanged 3+ weeks)
- kg/lbs toggle (converts display/input; always stores internally in lbs)
- "Save My Plan" modal — collects name + email → saved to `leads` table

### Check-In (page 2)
- Weekly weigh-in form: date, weight (in user's unit), optional note
- Edit any past check-in (prefills form, update replaces original)
- Delete check-ins
- Progress chart (SVG) overlaying actual vs. projected
- Streak counter (consecutive weekly check-ins)
- Milestone celebrations: 10%, 25%, 50%, 75%, 100% of goal lost (confetti + modal)
- Streak milestones: 4wk, 8wk, 12wk, 26wk, 52wk
- Share card (canvas → PNG download)

---

## Auth & Sync
- **Magic link** auth via Supabase (no password). User enters email → gets link → clicks it → signed in.
- **iOS PWA workaround:** magic link opens in Safari (different context from PWA). "Already clicked the link →" button calls `checkSessionManually()` → `sb.auth.getSession()` to pick up the session.
- `onAuthStateChange` handles SIGNED_IN and INITIAL_SESSION events
- On **SIGNED_IN**: captures any pre-signin local data, wipes local state, calls `syncDown()`. If cloud has no data (new user), restores captured local data so first-time sign-in doesn't erase what they entered. Then calls `syncUp()`.
- On **INITIAL_SESSION** (page reload while already signed in): skips local wipe, just calls `syncDown()` + `syncUp()`.
- On sign-out: syncs up first (1.5s timeout via Promise.race), clears all local state, resets form to defaults, does NOT call `calculate()` (would corrupt planData)
- 2-second debounced `syncUp()` after every calculator change; also flushes immediately on `visibilitychange` (app backgrounded or tab closed) so changes aren't lost in the debounce window
- **Name sync:** user's display name is stored in `planData.name` and synced to cloud. Restored by `restoreFormFromPlanData()` on sign-in. Name prompt is skipped for users with a `user_hint` in localStorage (signed-in users get their name back from cloud).
- Account button: shows "Sign In" when logged out; shows name initial (falls back to email initial) with name tooltip when signed in
- Account menu (signed in only): Send feedback (mailto) + Sign Out

---

## Analytics (PostHog)
- **Consent-gated:** PostHog only initialises after user clicks "Got it" on cookie banner
- **Anonymous tracking:** stable `trimly_device_id` in localStorage → `posthog.identify(deviceId)` before sign-in
- **Identity merge:** on sign-in, `posthog.identify(userId, {email})` links anonymous history to real user
- **Reset on sign-out:** `posthog.reset()` then re-identify with deviceId
- **Owner/dev mode:** `?dev=owner` in URL suppresses all analytics for that device permanently. Undo with `?dev=off`.
- **Test mode:** `?env=test` isolates localStorage (prefix `trimly_test_`) and suppresses analytics

### Events tracked
| Event | When |
|---|---|
| `app_loaded` | page load (has_plan, checkin_count, streak, returning_user) |
| `slider_moved` | any calculator input changes |
| `save_plan_opened` | Save My Plan modal opened |
| `email_captured` | form submitted with email |
| `save_plan_skipped` | skipped the email form |
| `sign_in_opened` | sync sheet opened |
| `magic_link_sent` | email submitted for OTP |
| `signed_in` | auth state changed to signed in |
| `signed_out` | user signed out |
| `checkin_added` | new check-in logged |
| `checkin_edited` | existing check-in updated |
| `milestone_celebrated` | milestone reached (milestone name, pct) |
| `cookie_consent` | accepted cookies |
| `data_exported` | data exported |
| `js_error` | uncaught JS error or unhandled rejection |

---

## Legal / Compliance
- **Cookie consent banner** appears 1.5s after first load if no decision stored. Stored in `localStorage` as `trimly_cookie_consent: 'accepted' | 'declined'`. PostHog only inits on 'accepted'.
- **Privacy policy** at `/trimly/privacy.html` — covers GDPR (weight as health data, special category, explicit consent basis), CCPA, named processors (Supabase + PostHog), user rights (access, delete, export, opt-out).
- **Privacy Policy link** in: cookie banner, sync sheet fine print, and footer of both app pages.

---

## Environment Variables (GitHub Secrets)
```
VITE_SUPABASE_URL       — Supabase project URL
VITE_SUPABASE_ANON_KEY  — Supabase anon/public key
```
Not present in `.env.local` locally → `sb` is null in dev → auth/sync silently disabled. App works fully without them (local-only mode).

---

## Key Behaviours / Gotchas
- **All weights stored in lbs** internally. `toLbs()` / `fromLbs()` / `fmtWt()` convert at UI boundary only.
- **Height defaults are 5'10" / 178cm everywhere** — `resetFormToDefaults()`, both `calculate()` branches, and HTML inputs all use the same value. Demo mode uses 5'9"/175cm intentionally for its fictional persona.
- **Edit check-in state:** `_editId` tracks which check-in is being edited. `addCheckin()` branches on `_editId !== null`.
- **planData corruption guard:** `signOut()` must NOT call `calculate()` — it would immediately recreate planData after clearing it, breaking syncDown on re-login.
- **Name is in planData:** `planData.name` holds the user's display name and syncs to cloud. `restoreFormFromPlanData()` restores it and calls `updateHeroGreeting()`. `saveName()` updates `planData.name` immediately and triggers a sync.
- **Supabase `user_plans` upsert:** uses `{onConflict: 'user_id'}` to update in place.
- **`checkins` unique constraint** is on `(user_id, date)` not `id` — duplicate date check happens in JS before insert.
- **Vite base path:** currently `/trimly/` for GitHub Pages. Must change to `/` if ever moving to a custom domain (also update Supabase allowed redirect URLs).
- **`privacy.html` is in `public/`** (not root) so Vite copies it verbatim to `dist/`.

---

## Planned / Future
- iOS app via Capacitor (wrap this PWA in native shell)
- Custom domain (check gettrimly.com / trimly.app — avoid $1500+ premium domains for now)
- Email campaigns to leads when iOS app launches (export from Supabase leads + auth.users tables)
- No email sending is wired up yet — leads are stored only, not emailed
