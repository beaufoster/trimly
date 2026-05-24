# WeightCast — Claude Code Context

## What this is
WeightCast is a personal weight loss calculator and weekly check-in tracker. React 18 + TypeScript PWA, deployed on Vercel.

**Live URL:** https://weightcast.com (also https://trimly-nu.vercel.app)  
**Repo:** https://github.com/beaufoster/trimly  
**Owner:** Beau Foster (beaudfoster@gmail.com)

---

## Stack
| Layer | Tech |
|---|---|
| Frontend | React 18 + TypeScript + Vite |
| State | TanStack Query v5 (server) + Zustand (UI) |
| Auth + DB | Supabase (project: `szjmfoicxzmdcesehcvp`) |
| Deployment | Vercel — push to `main` triggers deploy |
| Analytics | PostHog |
| Testing | Vitest (unit) + Playwright (e2e) |

---

## Key files
- `src/App.tsx` — root component, wires all hooks + pages
- `src/components/Calculator/` — calculator page and sub-cards
- `src/components/Checkin/` — check-in page, chart, list, progress snapshot
- `src/components/Auth/` — AuthSheet, OnboardingSheet (signup flow)
- `src/components/Account/` — AccountButton, AccountMenu, AccountSheet
- `src/components/Shared/` — TopNav, TabBar, Toast, Celebration
- `src/hooks/` — useAuth, useCheckins, usePlan, useProfile
- `src/store/ui.ts` — Zustand store for all UI state
- `src/lib/demoData.ts` — demo plan + check-ins shown when signed out
- `src/lib/storage.ts` — localStorage key constants (`tr_` prefix)
- `src/types/index.ts` — shared TypeScript types
- `src/css/styles.css` — all styles (single file)
- `public/sw.js` — service worker (cache key: `weightcast-v1`)

---

## Supabase tables
| Table | Purpose |
|---|---|
| `checkins` | Weekly weight logs: `user_id, date, weight, note, app_id` |
| `user_plans` | Calculator plan blob: `user_id, data jsonb, updated_at` |
| `profiles` | User profile: `user_id, display_name, unit_pref, updated_at` |

All tables have RLS — users can only read/write their own rows.

**Auth redirect URLs** (set in Supabase → Authentication → URL Configuration):
- Site URL: `https://weightcast.com`
- Redirect URLs: `https://weightcast.com/**`, `https://www.weightcast.com/**`, `https://trimly-nu.vercel.app/**`

---

## Signed-out / demo behaviour
When no user is signed in, the app shows read-only demo data (defined in `src/lib/demoData.ts`):
- Demo plan: average US male stats (199 lbs → 174 lbs, 5'9", 35 yo)
- Demo check-ins: 4 weeks of realistic entries
- Demo name: "Alex"
- All write actions (save plan, add/edit/delete check-in) open the signup sheet instead

---

## Test accounts (all deliver to beaudfoster@gmail.com)
| Email | Use |
|---|---|
| `beaudfoster+trimly-test1@gmail.com` | Primary test account |
| `beaudfoster+trimly-test2@gmail.com` | Secondary / multi-device tests |

Test password: ask Beau — not stored here.

To run in test mode (disables analytics, uses `trimly_test_` localStorage prefix):
```
https://weightcast.com/?env=test
```

---

## Running tests
```bash
npm test              # Vitest unit tests
npm run test:e2e      # Playwright e2e (starts dev server automatically)
npm run test:all      # Both

# Run e2e against live URL:
BASE_URL=https://weightcast.com npm run test:e2e

# Open Playwright report after a run:
npx playwright show-report
```

---

## What to test — full checklist

### Signed-out / demo mode
- [ ] Fresh visit → demo data visible (Alex, 199 lbs plan, 4 check-ins, chart)
- [ ] Hard refresh → demo data still visible (no blank state)
- [ ] "Save My Plan" → signup sheet opens
- [ ] Check-in form submit → signup sheet opens
- [ ] Sign out → localStorage cleared → demo data shown immediately

### Auth + onboarding flow
- [ ] Sign up → confirmation email → click link → onboarding sheet appears (name + units)
- [ ] Onboarding: enter name → Get Started → hero greeting shows name
- [ ] Onboarding: Skip for now → closes, no name set
- [ ] Sign in with existing account → data loads from Supabase
- [ ] Forgot password → reset email → "Set Your Password" form → signed in
- [ ] Auth sheet opens in Sign In mode for returning users

### Account settings
- [ ] Account avatar → menu → Account Settings
- [ ] Change display name → hero greeting updates
- [ ] Switch unit lbs↔kg → calculator values convert
- [ ] Change email → confirmation email sent
- [ ] Change password → can sign in with new password

### Calculator (signed in)
- [ ] Current weight auto-syncs from latest check-in
- [ ] Weight mode: goal weight + weeks to goal shown
- [ ] Date mode: target date + projected weight shown
- [ ] Pace buttons (Gentle/Steady/Aggressive) update weeks
- [ ] Unit toggle (lbs/kg) converts all values
- [ ] Save My Plan → saves to Supabase

### Check-in (signed in)
- [ ] Add check-in → appears in list, progress snapshot updates
- [ ] Add 3+ check-ins → chart shows actual + projected lines
- [ ] Pace badge shows On pace / Ahead / Behind
- [ ] Edit check-in → values pre-filled → save updates entry
- [ ] Delete → confirm → entry removed
- [ ] Duplicate date → error, no duplicate created

### Sync
- [ ] Sign out → sign back in → all data restored from Supabase
- [ ] Unit preference syncs across devices
- [ ] Name syncs across devices

### General
- [ ] PWA: manifest loads, installable on mobile
- [ ] Service worker registers (DevTools → Application → Service Workers)
- [ ] No JS errors on fresh load
- [ ] Works on mobile viewport (iPhone 14 size)

---

## Common gotchas
- **localStorage prefix:** `tr_` in production, `trimly_test_` when `?env=test`
- **SW cache:** hard refresh (Cmd+Shift+R) bypasses service worker. Cache key is `weightcast-v1` — bump it in `public/sw.js` if assets are stale after deploy
- **Demo data:** stored in `src/lib/demoData.ts` — never written to localStorage
- **Form cache:** only persisted (`tr_form`) when user is signed in; demo mode never writes to localStorage
- **startWt in Plan:** original starting weight preserved across plan updates; `plan.cw` updates with latest check-in
- **PostHog:** suppressed in test mode and owner mode (`?dev=owner`)
- **Supabase cold start:** first call after inactivity can take 1–2s
- **Recovery flow:** app checks URL hash `type=recovery` at load time for password reset

---

## When filing a bug
1. Steps to reproduce
2. Expected vs actual behaviour
3. Browser + device
4. Test mode (`?env=test`) — does it reproduce there?
5. Console errors
