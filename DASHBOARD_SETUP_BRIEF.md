# Trimly — Dashboard Setup Brief

## What Is Trimly
A weight loss planning PWA at `https://beaufoster.github.io/trimly`. Users enter their stats, get a projected timeline, and log weekly weigh-ins. Built with vanilla JS, hosted on GitHub Pages, backend on Supabase (Postgres + magic link auth), analytics via PostHog.

**Owner:** Beau Foster — `beaudfoster@gmail.com`

---

## Part 1 — PostHog Dashboard Setup

### Access
- PostHog project: already configured, Project ID `401941`, US Cloud
- URL: `https://us.posthog.com`
- Authorized domain: `beaufoster.github.io`

### Events Already Tracked (with properties)

| Event | Key Properties |
|---|---|
| `app_loaded` | `has_plan`, `checkin_count`, `streak`, `returning_user`, `mode` |
| `slider_moved` | `field`, `value` |
| `save_plan_opened` | — |
| `email_captured` | `has_name`, `plan_mode`, `streak` |
| `save_plan_skipped` | — |
| `sign_in_opened` | — |
| `magic_link_sent` | — |
| `signed_in` | `event` (SIGNED_IN / INITIAL_SESSION / manual_session_check) |
| `signed_out` | — |
| `checkin_logged` | `streak`, `has_note` |
| `checkin_edited` | — |
| `checkin_deleted` | — |
| `milestone_celebrated` | `milestone` (name), `pct` (0–100 or null for streak milestones) |
| `cookie_consent` | `action` (accepted) |
| `unit_toggled` | `unit` (kg / lbs) |
| `page_viewed` | `page` (calculator / checkin) |
| `safety_cap_changed` | `pace` (gentle / steady / aggressive) |
| `share_card_opened` | `streak`, `has_plan` |
| `share_card_downloaded` | — |
| `demo_loaded` | — |
| `data_exported` | `checkin_count` |
| `data_imported` | `imported`, `skipped` |
| `name_entered` | `name_length` |
| `js_error` | `type`, `message`, `source` |

All events also carry: `env`, `streak`, `has_checkins`, `plan_mode` (attached globally by the analytics wrapper).

---

### Dashboards to Build

#### Dashboard 1 — "Growth & Activation" (check daily)
- Total unique users — persons who fired `app_loaded`, last 30 days
- New vs returning users — `returning_user: false` vs `true` on `app_loaded`
- Email capture rate — `email_captured` ÷ `save_plan_opened` (conversion funnel)
- Sign-in rate — `signed_in` ÷ `sign_in_opened`
- Cookie consent acceptance rate — `cookie_consent` ÷ `app_loaded` (where no prior consent decision)
- Top referrer / traffic source breakdown (PostHog web analytics)

#### Dashboard 2 — "Engagement & Retention" (check weekly)
- Users with ≥1 check-in — persons who fired `checkin_logged` at least once
- Average streak at check-in — avg of `streak` property on `checkin_logged`
- Milestone celebration breakdown — bar chart of `milestone_celebrated` by `milestone` name
- Calculator vs Check-In page split — `page_viewed` grouped by `page`
- Pace preference — `safety_cap_changed` grouped by `pace`
- Unit preference — `unit_toggled` count (how many users switch to kg)
- Share card download rate — `share_card_downloaded` ÷ `share_card_opened`

#### Dashboard 3 — "Health & Errors" (check when something feels off)
- JS errors over time — `js_error` count grouped by `message`
- Magic link funnel — `sign_in_opened` → `magic_link_sent` → `signed_in`
- Demo load rate — `demo_loaded` count (signals confused or exploring users)

---

### Funnels to Create

**Save Plan funnel**
`save_plan_opened` → `email_captured`
Drop-off: `save_plan_skipped`

**Auth funnel**
`sign_in_opened` → `magic_link_sent` → `signed_in`

---

## Part 2 — Supabase Dashboard Setup

### Access
- Supabase dashboard: `https://supabase.com/dashboard`
- Project name: Trimly
- Owner email: `beaudfoster@gmail.com`

### Tables

```sql
-- Weekly check-ins (one per user per week)
checkins:
  id, user_id (FK auth.users), date, weight (float, stored in lbs),
  note (text), app_id, created_at
  UNIQUE (user_id, date)

-- One plan row per user (jsonb blob of calculator state)
user_plans:
  user_id (PK), data (jsonb), updated_at

-- Email leads from "Save My Plan" modal (no auth required)
leads:
  id, name (text), email (text), plan_mode (text),
  checkin_count (int), created_at
```

All tables have RLS enabled. `checkins` and `user_plans` restrict to `auth.uid() = user_id`. `leads` allows anonymous inserts only.

---

### Saved Queries to Create in SQL Editor

**1. Weekly active users (WAU)**
```sql
SELECT
  date_trunc('week', created_at) AS week,
  COUNT(DISTINCT user_id) AS active_users
FROM checkins
GROUP BY 1
ORDER BY 1 DESC;
```

**2. User retention — check-in consistency**
```sql
SELECT
  user_id,
  COUNT(*) AS total_checkins,
  MIN(date) AS first_checkin,
  MAX(date) AS last_checkin,
  ROUND(COUNT(*) / NULLIF(
    EXTRACT(WEEK FROM AGE(MAX(date::date), MIN(date::date))), 0
  ), 2) AS consistency_rate
FROM checkins
GROUP BY user_id
ORDER BY total_checkins DESC;
```

**3. Lead capture over time**
```sql
SELECT
  date_trunc('week', created_at) AS week,
  COUNT(*) AS new_leads,
  COUNT(CASE WHEN plan_mode = 'weight' THEN 1 END) AS weight_mode_leads,
  COUNT(CASE WHEN plan_mode = 'date' THEN 1 END) AS date_mode_leads
FROM leads
GROUP BY 1
ORDER BY 1 DESC;
```

**4. Total users / leads summary (run on demand)**
```sql
SELECT
  (SELECT COUNT(*) FROM auth.users) AS total_accounts,
  (SELECT COUNT(*) FROM leads) AS total_leads,
  (SELECT COUNT(DISTINCT user_id) FROM checkins) AS users_with_checkins,
  (SELECT COUNT(*) FROM checkins) AS total_checkins,
  (SELECT ROUND(AVG(cnt), 1) FROM (
    SELECT COUNT(*) AS cnt FROM checkins GROUP BY user_id
  ) t) AS avg_checkins_per_user,
  (SELECT COUNT(*) FROM leads
   WHERE created_at > NOW() - INTERVAL '7 days') AS leads_last_7d;
```

**5. Most active users (for outreach)**
```sql
SELECT
  u.email,
  COUNT(c.id) AS checkin_count,
  MIN(c.date) AS started,
  MAX(c.date) AS last_checkin
FROM checkins c
JOIN auth.users u ON u.id = c.user_id
GROUP BY u.email
ORDER BY checkin_count DESC
LIMIT 20;
```

---

### Table Editor Bookmarks to Set Up
- **leads** — filtered to last 30 days, sorted by `created_at DESC` (quick lead review)
- **checkins** — columns: `user_id`, `date`, `weight`, `note` (support lookups)
- **Authentication → Users** — account management

---

## Key Numbers to Check After Every Marketing Push

| Metric | Where |
|---|---|
| New `app_loaded` users today / this week | PostHog — Growth dashboard |
| `email_captured` count | PostHog — Growth dashboard |
| `signed_in` count (accounts created) | PostHog — Growth dashboard |
| `checkin_logged` count | PostHog — Engagement dashboard |
| Any spike in `js_error` | PostHog — Health dashboard |
| New leads this week | Supabase — leads query |

---

## Important Notes for Setup

- **PostHog person profiles** are set to `identified_only` — anonymous users don't create profiles until they accept the cookie banner and/or sign in. Funnel numbers before sign-in are device-based (stable device ID stored in localStorage as `trimly_device_id`).
- **All weights are stored in lbs** in Supabase, even for users who have selected kg mode. Unit conversion happens only in the UI.
- **Test mode** (`?env=test` in URL) uses a `trimly_test_` localStorage prefix and suppresses all analytics. Do not confuse test-mode events with real production data.
- **Owner/dev mode** (`?dev=owner` in URL) suppresses analytics permanently for that device. Undo with `?dev=off`.
- The `leads` table captures emails from the "Save My Plan" modal — these users may or may not have a Supabase auth account. Cross-reference `leads.email` with `auth.users` to identify overlap.
