# Changelog

## v1.6.5 — Expanded test suite & doc refresh (2026-06-17)

_Internal — tests + docs only, nothing user-facing deploys._

- Test suite grown from 42 to **66**. New unit tests for previously-uncovered
  modules: time math (month/year/leap boundaries), session HMAC (tamper/expiry/
  wrong-secret), analytics aggregation (xp curve, heatmap, radar, level markers),
  email-template HTML escaping (XSS) + unsubscribe links, server stats helpers,
  the rate limiter, the cron streak-freeze auto-bridge, and a full `rebuildXp`
  derivation across all XP sources.
- README refreshed: data model (`users.theme`, `xp_events.ref`), migrations
  004/005, API table (`/stats`, undo endpoints, `/me`, export/delete), and the
  test-coverage list.

## v1.6.4 — Mobile safe-area polish (2026-06-17)

- Audited every page at 390px — no horizontal overflow; charts, heatmaps, sheets,
  badge grid and bottom nav all render cleanly. The one real gap was the top
  safe-area: the header now clears the notch / status bar via
  `env(safe-area-inset-top)`, and the app container respects left/right insets.
- Added iOS PWA fullscreen metas (`apple-mobile-web-app-capable`,
  `status-bar-style: black-translucent`) so an installed icon launches edge-to-edge
  with the header correctly inset. No change on non-notched/desktop (insets → 0).
- SW cache -> v1.6.4.

## v1.6.3 — Cursor-following glow on widgets (2026-06-16)

- A highlight glow now follows the cursor across all widget cards/tiles, with a
  subtle hover lift + brighter edge (`lib/glow.js`: one delegated pointermove +
  rAF, one rect read per frame, writes only `--mx/--my`; desktop pointers,
  reduced-motion-safe). The dashboard hero gets the same glow plus its 3D tilt.
- Fixed `useTilt` so the hero actually tilts: it's now a callback ref, so it binds
  when the hero mounts (it renders only after data loads, so the old effect-on-mount
  missed it). SW cache -> v1.6.3.

## v1.6.2 — Show app version (2026-06-16)

- Discreet version number in the Settings footer, sourced once from
  `package.json` and injected at build time via a Vite `define`
  (`__APP_VERSION__`). Bump `package.json` version + the SW cache together per
  release.

## v1.6.1 — Fix select dropdown stacking (2026-06-16)

- The custom select dropdown was rendered absolutely inside its card and got
  trapped behind the following card (stacking-context overlap). It now portals to
  `<body>` with fixed coordinates computed from the trigger rect (upward flip when
  low on space, repositions on scroll/resize, z-index above sheets). Works
  correctly inside bottom sheets too; Esc closes only the select, not the sheet.

## v1.6.0 — Obsessive-detail craft pass (2026-06-16)

Concept that guided it: *"a heads-up control room for your training — every metric
a dial, every action a satisfying mechanical response."*

- **Premium navigation** — own scroll restoration: forward (PUSH) lands at top and
  plays the entrance; back/forward (POP) restores the exact previous scroll
  instantly and does **not** replay entrances (`lib/useScrollRestoration.js`,
  retries until async pages are tall enough). `history.scrollRestoration = manual`.
- **Bespoke select** — native `<select>` replaced everywhere with an accessible
  listbox/combobox (`components/Select.jsx`): ↑/↓ · Home/End · Enter/Space · Esc ·
  type-ahead · outside-click, `aria-activedescendant`, focus-visible.
- **Dialogs done right** — bottom sheets now trap focus, take initial focus,
  close on Esc, and **return focus to the trigger** on close (captured at render
  time so a child `autoFocus` can't steal it; refocus retried past React's churn).
- **Signature reactive moment** — the dashboard hero tilts toward the cursor with
  a damped spring and a tracking light, gated to real pointers, idle loop stops
  (`lib/useTilt.js`).
- **Invisible details** — focus-visible rings on every control, `text-wrap:balance`
  on headings, ≥44px touch targets on coarse pointers.
- SW cache -> v1.6.0.

## v1.5.0 — Expressive animations (2026-06-16)

Material 3 Expressive motion pass across the app (all `prefers-reduced-motion` aware):

- **Touch ripple** on buttons, chips, tiles, tappable cards, FAB and nav items
  (delegated pointer listener, `src/lib/ripple.js`).
- **Count-up numbers** — dashboard stat tiles, streak-ring value and the Statistik
  headline animate from 0 with an easeOutCubic ramp (`components/CountUp.jsx`).
- **Progress bars grow in** (scaleX) on mount with a brief shine.
- **Bottom-nav spring** — the active tab pops and its icon hops on switch.
- **Chips spring** on selection.
- **Confetti burst** on level-up / achievement unlock (`components/Confetti.jsx`),
  wired into `useToast().celebrate`.
- SW cache -> v1.5.0.

## v1.4.0 — Motivational statistics dashboard (2026-06-15)

- New **Statistik** page (`/stats`, linked from the dashboard) with several
  motivation-first visualizations from a single `GET /api/stats` aggregate
  (`server/analytics.js`):
  - cumulative **XP growth curve** with level-threshold markers
  - **activity heatmap** (intensity = XP earned per day, theme-aware colors)
  - **weekly rhythm** bars (check-ins vs. workouts)
  - **balance radar** across Konsistenz / Training / Ernährung / Körper /
    Wohlbefinden (30-day view)
  - **workout-category donut**
  - headline scalars (30-day XP, active days, best day)
- Heatmap cells now blend the active theme's primary color (via `color-mix`).
- README gains a Statistik screenshot. Tests at **42**. SW cache -> v1.4.0.

## v1.3.1 — Theme syncs per account + mobile polish (2026-06-15)

- **Theme is now saved on the account** (migration `005_user_theme`), so it
  follows you across devices/browsers — not just `localStorage`. `/me` returns it;
  `PUT /me` persists it (validated against the allowed set). localStorage stays as
  the instant pre-paint cache; the account is the source of truth on load.
- **Mobile polish:** the 6-tab bottom navigation now fits narrow phones (≤430px)
  without horizontal scrolling (tighter spacing, evenly distributed).

## v1.3.0 — Themes & expressive animations (2026-06-15)

- **Theme switcher** with 4 complete Material 3 Expressive palettes: Electric Lime
  (default), **Ember** (warm coral/amber), **Aqua** (cyan/sky), **Grape** (violet/
  magenta). Picked in Settings → Design, persisted in `localStorage`, applied
  before paint (no flash), with the PWA theme-color synced per theme.
- **Visible animations:** an accent "wash" sweep on theme change, page transitions
  on route change, staggered card/tile/badge entrance, streak-ring pop, FAB spring
  and a shimmering level progress bar — all gated by `prefers-reduced-motion`.

## v1.2.1 — Reversible XP on undo (2026-06-15)

- **Undoing an action now removes the XP it granted** (and recomputes the level).
  XP events are tagged with a source `ref` (`checkin:<day>`, `workout:<id>`,
  `entry:<id>`, `nutrition:<day>`, `metric:<id>`); deleting the action reverses
  exactly those events. Deleting a check-in also recomputes the streak from the
  surviving history. (Achievements stay earned — their bonus is not revoked.)
- Added `rebuildXp` + `scripts/rebuild-xp.js`, a deterministic, idempotent repair
  that rebuilds a user's XP ledger from ground truth — fixes accounts inflated by
  earlier deletes that didn't reverse XP. Migration `004_xp_ref` adds the `ref`
  column. Tests at **41**.

## v1.2.0 — Configurable streak-freeze (2026-06-15)

A fully user-configurable "streak freeze" system — both **scoring** and **presentation**:

- **Scoring:** max freezes, four earn modes (per streak-milestone, per X check-ins,
  weekly gift, on level-up), `count_mode` `grow` (frozen day grows the streak) vs
  `preserve` (only keeps it alive), and automatic application on a missed day.
- **Presentation:** custom name, icon, color and description.
- **Engine:** milestone-based, idempotent earning (`reconcileEarn` on check-in +
  daily cron); missed days auto-bridged in `recomputeStreak` (next check-in) and the
  new `runFreezeApply` cron (00:30, runs even without email). Event ledger
  (`freeze_events`) powers the in-app history. New tables `streak_freeze` +
  `freeze_events` (migration `003_streak_freeze`).
- **UI:** config sheet in Settings, freeze balance on the dashboard, and a
  "Serie geschützt" toast when a freeze is consumed.
- Tests expanded to **38** (freeze logic + API integration).

## v1.1.3 — Achievement balancing & detail view (2026-06-14)

- **Tappable achievement detail**: each badge opens a sheet explaining how to unlock
  it ("So schaltest du es frei"), its XP bonus, and the unlock date when earned.
- **Realism pass on achievements (now 29):**
  - Removed the 365-day *consecutive* streak — unrealistic (one missed day resets it).
    Streaks now top out at the attainable 100-day mark; the "one year" theme lives on
    via the forgiving cumulative *365 check-ins* badge.
  - Recalibrated volume thresholds (a single workout already moves ~5–12 t):
    10/50/100 t → **25/100/500 t** so they're meaningful long-term goals.

## v1.1.1 — More achievements (2026-06-14)

- Expanded achievements from 11 to **30**, including long-term milestones:
  streaks up to **365 days**, check-ins/workouts up to 250–365, volume to **100 t**,
  levels up to **50**, data milestones (8 trackers, 100/500 entries), nutrition (30 days)
  and personal-record badges.
- Achievement context now includes personal-record count and tracker count; the
  "first metric" badge keys off tracker entries.

## v1.1.0 — Flexible tracker system, goals, insights (2026-06-14)

### Added — track anything your way
- **Universal tracker system**: user-defined trackers with 6 input types
  (number, scale, boolean, duration, choice, text), each with name, icon, color,
  category, optional goal (+ direction) and configurable XP per entry.
- **Template gallery** for one-tap creation (weight, sleep, water, mood, steps, …),
  all fully editable afterwards.
- **Editable pickers**: custom check-in activity types and workout categories
  (`user_options`); **exercise library** with autocomplete in the workout form.
- **Goals**: per-tracker target + direction (up/down/maintain) with progress on the
  dashboard and tracker detail.
- **Personal records**: automatic best-estimated-1RM (Epley) detection per exercise
  on every workout, with a celebratory toast; surfaced on the dashboard.
- **Flexible charts**: range selector (7/30/90/365/all) + moving-average overlay.
- **Insights**: correlation analysis between any two numeric trackers
  (Pearson r + scatter plot), e.g. sleep vs. mood.
- New routes `/trackers`, `/trackers/:id`, `/insights`; bottom nav now includes
  **Tracker**.

### Changed
- Dashboard now shows goals + personal records + an Insights entry point
  (replaced the single hard-coded weight chart).
- Body page removed — body measurements are now ordinary trackers.

### Migrations
- `002_trackers`: adds `trackers`, `tracker_entries`, `user_options`,
  `personal_records`; migrates existing `metrics` rows into trackers (category `body`)
  with no data loss.

### Tests
- Expanded to **26** tests: tracker logic (1RM, goal progress, correlation, moving
  average, default seeding), DB flows (entries, PRs, options, cascade delete), and an
  in-memory **API integration test** exercising the tracker endpoints over HTTP.

## v1.0.1 — Open Graph share image + social meta tags

## v1.0.0 — Initial release
- Multitenant Google-auth fitness/body tracking PWA (Material 3 Expressive).
- Body metrics, check-ins, workouts, nutrition; gamification (XP/levels/streaks/
  badges); motivational emails (weekly/streak/daily) via node-cron + nodemailer.
- GDPR export & account deletion.
