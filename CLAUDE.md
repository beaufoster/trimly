# Trimly — Claude Code Context

## What this is
Trimly is a personal weight loss calculator and weekly check-in tracker. It's a Vite-based vanilla JS PWA (no React, no TypeScript), deployed on Vercel.

**Live URL:** https://trimly-nu.vercel.app  
**Repo:** https://github.com/beaufoster/trimly  
**Owner:** Beau Foster (beaudfoster@gmail.com)

---

## Stack
| Layer | Tech |
|---|---|
| Frontend | Vanilla JS + Vite (single `app.js`, single `styles.css`) |
| Auth + DB | Supabase (project: `szjmfoicxzmdcesehcvp`) |
| Deployment | Vercel — auto-deploys on push to `main` |
| Analytics | PostHog |
| Testing | Vitest (unit) + Playwright (e2e) |

---

## Key files
- `src/js/app.js` — all app logic (~1700 lines, single file by design)
- `src/css/styles.css` — all styles
- `index.html` — single HTML file, all markup
- `public/sw.js` — service worker (cache key: `trimly-v2`)
- `src/js/supabase.js` — Supabase client init
- `src/js/utils.js` — BMR calc, simulation, streak helpers
- `tests/e2e/` — Playwright e2e tests
- `tests/unit/` — Vitest unit tests

---

## Supabase tables
| Table | Purpose |
|---|---|
| `checkins` | Weekly weight logs: `user_id, date, weight, note, app_id` |
| `user_plans` | Calculator plan blob: `user_id, data jsonb, updated_at` |
| `profiles` | User profile: `user_id, display_name, unit_pref, updated_at` |

All tables have RLS — users can only read/write their own rows.

---

## Test accounts (all deliver to beaudfoster@gmail.com)
| Email | Use |
|---|---|
| `beaudfoster+trimly-test1@gmail.com` | Primary test account |
| `beaudfoster+trimly-test2@gmail.com` | Secondary / multi-device tests |

Test password: ask Beau — not stored here.

To run in test mode (disables analytics, uses `trimly_test_` localStorage prefix):
```
https://trimly-nu.vercel.app/?env=test
```

---

## Running tests
```bash
npm test              # Vitest unit tests
npm run test:e2e      # Playwright e2e (starts dev server automatically)
npm run test:all      # Both

# Run e2e against live Vercel URL instead of localhost:
BASE_URL=https://trimly-nu.vercel.app npm run test:e2e

# Run a single file:
npx playwright test tests/e2e/app.spec.js

# Open Playwright report after a run:
npx playwright show-report
```

---

## What to test — full checklist

### Auth flow
- [ ] Sign up with `+trimly-test1` email → confirmation email arrives → click link → signed in
- [ ] Sign out → sign back in with password → data restored
- [ ] Forgot password → reset email arrives → click link → lands on "Set Your Password" form (not auto-signed in) → set password → signed in
- [ ] Auth sheet opens in **Sign In** mode for returning users (has `tr_user_hint` in localStorage)
- [ ] Auth sheet opens in **Create Account** mode for new users

### Account settings
- [ ] Tap account avatar → menu appears → "Account Settings" opens the sheet
- [ ] Change display name → save → hero greeting updates
- [ ] Switch unit lbs↔kg → syncs immediately, calculator values convert
- [ ] Update email → "Check your new inbox" message shown → confirmation email arrives
- [ ] Update password → success → can sign in with new password

### Calculator
- [ ] All sliders update results live (debounced 150ms)
- [ ] Weight mode: goal weight field visible, weeks to goal shown
- [ ] Date mode: goal date picker visible, projected weight shown
- [ ] Pace buttons (Gentle/Steady/Aggressive) update weeks
- [ ] Unit toggle (lbs/kg) converts all values correctly
- [ ] Goal weight ≥ current weight shows validation error
- [ ] Save My Plan → modal opens → download PDF works

### Check-in
- [ ] Add a check-in → appears in list → calculator updates progress snap
- [ ] Add 3+ check-ins → chart appears
- [ ] Edit a check-in → values pre-filled → save updates entry
- [ ] Delete → "Confirm?" appears → confirm → entry removed with animation
- [ ] Duplicate date → error shown, no duplicate created
- [ ] Share card → opens → downloads PNG

### Sync
- [ ] Sign in → data from Supabase merges with local data
- [ ] Add check-in while signed in → flash on account button confirms sync
- [ ] Sign out → sign back in → check-ins restored from cloud
- [ ] Unit preference syncs: change to kg on device A → sign in on device B → shows kg
- [ ] Name syncs: set name on device A → sign in on device B → hero greeting shows name

### General
- [ ] 404 page: visit `/anything-invalid` → custom Trimly 404 page with "Back to Trimly" link
- [ ] PWA: manifest loads, icons present, installable on mobile
- [ ] Service worker registers (check DevTools → Application → Service Workers)
- [ ] No JS errors in console on fresh load
- [ ] Works on mobile viewport (iPhone 14 size)

---

## Common gotchas
- **localStorage prefix:** `tr_` in production, `trimly_test_` when `?env=test` is in the URL
- **SW cache:** hard refresh (Cmd+Shift+R) bypasses service worker. Cache key is `trimly-v2` — bump it in `public/sw.js` if assets are stale after deploy
- **Calculator debounce:** 150ms — always `waitForTimeout(300)` after slider changes in tests
- **Auth sheet animations:** 300ms slide-up — wait before interacting with sheet contents
- **PostHog:** suppressed in test mode (`?env=test`) and owner mode (`?dev=owner`)
- **Supabase cold start:** first Supabase call after inactivity can take 1–2s
- **Recovery flow:** `PASSWORD_RECOVERY` event vs `SIGNED_IN` — app checks URL hash `type=recovery` at load time to handle both cases

---

## When filing a bug
Record:
1. Steps to reproduce
2. Expected vs actual behaviour
3. Browser + device
4. Whether it happens in test mode (`?env=test`)
5. Any console errors
