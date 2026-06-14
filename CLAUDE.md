# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`drill` (drill.celox.io) — a multitenant fitness/body-tracking PWA. Users sign in with Google,
track body metrics / gym attendance / workouts / nutrition, and are nudged to stay consistent via
charts, gamification (XP, levels, streaks, badges) and motivational emails. Visual language is
**Material 3 Expressive**. Same deployment family as xword/xchange (VPS nginx + systemd + SQLite).

## Layout

- **Frontend** (repo root): React + Vite PWA. `src/pages/*` = routes, `src/components/*` = shared UI,
  `src/theme/tokens.css` = the entire MD3 Expressive token set (colors, shape scale, motion springs).
  `src/index.css` holds the hand-built component classes (no Material Web Components).
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

- **Sessions** are HMAC-SHA256-signed cookies (`server/session.js`), not JWTs. **OAuth** is the raw
  authorization-code flow in `server/auth.js`; the ID token is verified via Google's `tokeninfo`
  endpoint (no JWKS). This mirrors xword exactly.
- **Gamification is server-authoritative** (`server/gamification.js`): XP is an append-only ledger
  (`xp_events`) plus a denormalized rollup on the `users` row. Every tracking write goes through
  `awardXp` + `checkAchievements` and returns a `gami` delta so the client can celebrate
  level-ups/badges immediately (`useToast().celebrate`).
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
