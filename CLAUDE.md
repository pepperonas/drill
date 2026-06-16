# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`drill` (drill.celox.io) — a multitenant fitness/body-tracking PWA. Users sign in with Google,
track body metrics / gym attendance / workouts / nutrition, and are nudged to stay consistent via
charts, gamification (XP, levels, streaks, badges) and motivational emails. Visual language is
**Material 3 Expressive**. Same deployment family as xword/xchange (VPS nginx + systemd + SQLite).

## Layout

- **Frontend** (repo root): React + Vite PWA. `src/pages/*` = routes (Dashboard, Trackers,
  TrackerDetail, Insights, Training, Nutrition, Attendance, Achievements, Settings),
  `src/components/*` = shared UI (Sheet, Toast, NavBar, TrackerForm/EntryInput),
  `src/lib/trackerTypes.js` = tracker type/category/template metadata used by the forms,
  `src/theme/tokens.css` = the entire MD3 Expressive token set (colors, shape scale, motion springs)
  with 4 themes as `[data-theme="…"]` blocks (lime default + ember/aqua/grape); `src/theme/themes.js`
  + `ThemeContext.jsx` drive the switcher. **The account is the source of truth** (`users.theme`,
  migration 005; `GET/PUT /me`); localStorage is the pre-paint cache (inline script in index.html),
  and `ThemeContext` adopts `user.theme` on load + persists changes via `api.setTheme`.
  `<meta theme-color>` is synced per theme. `src/index.css` holds the hand-built component
  classes (no Material Web Components) and all motion: entrance/page/theme-wash plus the Expressive
  set — touch ripple (`lib/ripple.js`, installed once in main.jsx; CSS `.ripple-ink`), count-up numbers
  (`components/CountUp.jsx`), scaleX progress-bar grow, nav-active spring, chip pop, and confetti
  (`components/Confetti.jsx`, fired by `useToast().celebrate`). Keep CSS animations FINITE — an infinite
  keyframe makes Playwright screenshots hang.
- **Backend** (`server/`): Express + better-sqlite3. Entry `index.js` → `app.js` (wiring) → `routes/*`.

## Commands

```bash
# frontend
npm install && npm run dev      # http://localhost:5180, proxies /api -> :4252
npm run build                   # -> dist/

# backend
cd server && npm install
npm run dev                     # node --watch, http://127.0.0.1:4252
npm test                        # node:test — gamification/streak/level logic
```

Local dev needs `server/.env` (copy from `server/.env.example`). With `APP_ORIGIN=http://...`
the session cookie's `secure` flag is auto-relaxed so http login works.

## Architecture notes (the non-obvious parts)

- **Flexible tracker system is the core** (`server/trackers.js`, `server/routes/trackers.js`,
  tables `trackers` + `tracker_entries`). A tracker is any user-defined thing to log; type ∈
  {number, scale, boolean, duration, choice, text}. Numeric-ish values live in `value`, text/choice
  in `text_value`. Adding a new metric is a **row, not a schema change**. `server/trackers.js` holds
  the pure logic: `seedDefaultsIfEmpty`, `goalProgress`, `est1RM` (Epley), `alignSeries`/`pearson`
  (correlation), `movingAverage`. New users get default trackers seeded lazily on first `GET /trackers`.
- **Editable pickers**: `user_options` (domains `activity`, `workout_category`) make the otherwise-fixed
  check-in/workout lists user-extensible. Frontend merges built-in defaults with these.
- **Personal records**: `personal_records` (one best est-1RM per exercise); `detectPRs` in
  `routes/tracking.js` runs on every workout POST and returns new PRs so the UI can celebrate.
- **Legacy `metrics`** table is migrated into `trackers` by migration `002_trackers` (category `body`)
  and otherwise unused by the UI — don't add new features to it.
- **Streak-freeze** (`server/streakfreeze.js`, `routes/streakfreeze.js`, tables `streak_freeze` +
  `freeze_events`) is fully user-configurable — scoring (max, earn modes, grow-vs-preserve count,
  auto-apply) and presentation (name/icon/color). Earning is **milestone-based & idempotent**
  (`ck/st/lvl_milestone` store the highest already-granted level, so `reconcileEarn` can run on every
  check-in AND daily in cron without double-granting; the streak milestone drops when a streak resets).
  Missed days are bridged in two places: `recomputeStreak(db,user,day,cfg)` on the next check-in, and
  the daily `runFreezeApply` cron (00:30) which also does the weekly gift + level reconcile. The freeze
  cron runs even when email is disabled. `count_mode==='grow'` makes a frozen day count toward streak
  length; `'preserve'` only keeps the streak alive.
- **Sessions** are HMAC-SHA256-signed cookies (`server/session.js`), not JWTs. **OAuth** is the raw
  authorization-code flow in `server/auth.js`; the ID token is verified via Google's `tokeninfo`
  endpoint (no JWKS). This mirrors xword exactly.
- **Gamification is server-authoritative** (`server/gamification.js`): XP is an append-only ledger
  (`xp_events`) plus a denormalized rollup on the `users` row. Every tracking write goes through
  `awardXp` + `checkAchievements` and returns a `gami` delta so the client can celebrate
  level-ups/badges immediately (`useToast().celebrate`).
- **XP is reversible on undo.** Each `xp_events` row carries a source `ref`
  (`checkin:<day>` / `workout:<id>` / `entry:<id>` / `nutrition:<day>` / `metric:<id>` /
  `achievement:<code>`). Delete endpoints call `reverseXpByRef(db, user, ref)` to drop those events
  and recompute the rollup; deleting a check-in also calls `recomputeStreakFromHistory`. Achievements
  are NOT revoked on undo (earned = kept). `rebuildXp(db, user)` deterministically rebuilds the whole
  ledger from current data (repair for drifted accounts); run it via `node scripts/rebuild-xp.js [id]`.
- **Analytics/Statistik**: `server/analytics.js` `computeStats()` builds the whole `/api/stats` payload
  (XP growth curve + level markers, XP-per-day heatmap, weekly check-in/workout buckets via `isoWeekKey`,
  30-day balance radar, workout-category donut, headline scalars). Frontend `src/pages/Stats.jsx`
  (route `/stats`) renders it with Recharts; the heatmap reuses `.hm-cell` (theme-aware via `color-mix`).
  Note: Recharts `ResponsiveContainer` collapses under Playwright fullPage capture — screenshot with a
  tall fixed viewport instead.
- **Days are timezone-local strings** (`YYYY-MM-DD` in the user's tz, `server/time.js`) so streaks
  and "today" match the user's wall clock, not UTC. The client reports its tz to `/api/me` on load.
- **Metrics are generic** (`metrics` table: kind/value/unit/day) — adding a new body measurement is a
  client-side entry in `METRIC_KINDS` (`src/lib/util.js`), no schema change.
- **Emails**: `server/cron.js` schedules daily-nudge / streak-alert / weekly via node-cron, all gated
  on double-opt-in (`email_prefs.confirmed`) and deduped per day via `email_log`. Templates in
  `server/email-templates.js`. If SMTP creds are absent, email is silently disabled (dev-safe).
- **Schema migrations** are append-only in `server/migrations.js` — never edit an applied migration.

## Conventions

- Match the existing hand-rolled style: no ORM, no component library, prepared statements in `db.js`,
  CSS custom properties for all theming (never hardcode colors — use `var(--primary)` etc.).
- When changing the SW or shipping a frontend release, bump `CACHE` in `public/sw.js`.
- Deployment details (nginx/systemd/certbot/backups, port **4252**): see `DEPLOY.md`.

## Secrets

Live only in `/opt/drill-api/.env` on the VPS (mode 640): Google OAuth creds, `SESSION_SECRET`
(`openssl rand -hex 32`), Hostinger SMTP. Never committed.
