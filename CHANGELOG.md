# Changelog

## v1.10.0 — Dialog fixes, gym quick-starts & audit fixes (2026-07-02)

- **Fix: dialogs got clipped / the save button was cut off** — sheets used `vh`
  (breaks with the mobile keyboard) and had no always-visible primary action. Now
  `dvh` + a **sticky action footer** (Workout/Ernährung/Tracker/Streak-Schutz), and
  on **wide screens the bottom-sheet becomes a centered modal**. "Speichern" is
  always reachable.
- **Fix: Hantel-/Gym-Training was buried** — the Schnellstart only had home/bodyweight
  presets. Added **weighted gym quick-starts** (Ganzkörper · Push · Pull · Beine) in
  their own 🏋️ Gym row, a built-in **gym exercise library** (Bankdrücken, Kniebeuge,
  Kreuzheben, Rudern, Klimmzüge, …) in the autocomplete, and grouped the picker
  Gym / Zuhause.
- **Backend audit fixes:** `rebuildXp` now re-derives **GPS-activity XP** (it was
  dropped on a ledger rebuild — real bug); a global Express **error handler** (a
  thrown request → 500 instead of a crash); activity uploads reject non-finite
  numbers and survive a concurrent same-`client_uuid` race; pairing-code generation
  guards against collision exhaustion.
- A11y: toasts announce via `role=status`/`aria-live`; toggle chips get `aria-pressed`.
- Tests **90 → 91** (rebuildXp-with-activity regression). SW cache -> v1.10.0.

## v1.9.0 — GPS activities + device pairing (server & web) (2026-07-01)

Backend + web foundation for the native **drill · go** Android companion app that
GPS-tracks walks/runs/rides and uploads them.

- **Activities API** (`server/routes/activities.js`, migration `008_activities`):
  `POST/GET/DELETE /api/activities`. Uploads carry an encoded polyline, distance,
  duration, speed and steps; they award XP (`20 + 6/km`, capped) reversibly, count
  the day toward the streak via an idempotent check-in, and are idempotent on
  `client_uuid` (offline-sync retries never double-count).
- **Device pairing** (`server/routes/pairing.js`, migration `009_device_pairing`):
  the web mints a short-lived code (Settings → **Gerät koppeln**), the app exchanges
  it for an opaque bearer token (stored only as a SHA-256 hash, revocable).
  `requireUser` now accepts `Authorization: Bearer` in addition to the cookie.
- **New achievements:** Losgezogen 🗺️, Unterwegs/Entdecker 🚶🧭, 50/250/1000 km
  📍🌍🚀, Läufer 🏃, Radfahrer 🚴.
- **Web:** new **Aktivitäten** page (`/activities` + detail) with a **MapLibre**
  keyless route map (lazy-loaded, own chunk) and a dependency-free SVG route
  thumbnail in the list; entry point from the dashboard.
- Tests **79 → 90** (activities + pairing end-to-end). SW cache -> v1.9.0.

## v1.8.2 — Public email links + expanded tests (2026-06-26)

- **Fix: email confirm/unsubscribe links required a session.** Those endpoints are
  meant to work straight from an email (e.g. opened on another device), but the
  account router was mounted *after* the feature routers — whose blanket
  `requireUser` 401'd the request first. Mounted accountRoutes first so the public
  links work without being logged in. Caught by a new end-to-end test.
- **8 new tests (71 → 79):** mixed weighted+bodyweight intensity & garbage-input
  safety; `sumVolume` honoring `set_count`; `levelProgress` boundary fields;
  `rebuildXp` re-deriving a workout's intensity bonus + tying it to one `ref`;
  the per-day streak-bonus cap (50); the email confirm/unsubscribe endpoints; and
  workout-delete reversing base **and** intensity XP. SW cache -> v1.8.2.

## v1.8.1 — Fix repeating email-confirm toast (2026-06-26)

- The "✅ E-Mails bestätigt!" notice after confirming your email (and the
  unsubscribe notice) fired **repeatedly** instead of once. The Settings effect
  depended on `toast`, whose identity changes every time a toast is shown (the
  provider re-renders) — so it re-read the still-present `?confirmed=1` from the
  URL and looped. Now it fires exactly once (ref guard) and strips the one-shot
  query param via the router so a remount can't re-show it. SW cache -> v1.8.1.

## v1.8.0 — Flexible set entry + workout intensity score (2026-06-21)

Maximum input flexibility, and every workout now earns points for how hard it was.

- **Per-row set count** — log "3 Sätze × 12 Wdh" as a *single* row instead of three
  identical ones (migration `007`, `workout_sets.set_count`). The set table gains a
  **Sätze** column; the card renders it as `3 × 12 × 20 kg`.
- **Weight is optional everywhere** — enter dumbbell sets with reps and no weight at
  all (not just in bodyweight mode). The server normalizes empty/absent weights to
  `null`; weightless sets never fabricate a PR.
- **⚡ Intensity score per workout** (`trackers.workoutIntensity`, stored on
  `workouts.intensity`): blends **tonnage** (Σ sets·reps·weight), **rep work**
  (Σ sets·reps, so bodyweight counts) and **set volume** (Σ sets) into one number —
  so *any* training entry is measurable. It’s shown on the card and in the save toast.
- **Points for intensity** — the workout reward is now `40 base + intensity bonus`
  (capped at 120, reason `workout_intensity`, same `ref` so undo reverses both and
  `rebuildXp` re-derives it deterministically). Volume totals/achievements now
  multiply by the set count too.
- Tests at **71** (intensity math + clamp unit tests; an end-to-end "3 dumbbell sets,
  no weight" API test asserting one stored row, a positive score and base+bonus XP).
  SW cache -> v1.8.0.

## v1.7.0 — Home & bodyweight workouts (2026-06-21)

Logging a short session at home is now a first-class, two-tap flow (it was
technically possible before, but the form was gym-centric: weight×reps sets and
gym-split categories).

- **Place selector** on every workout — 🏋️ Gym · 🏠 Zuhause · 🌳 Draußen
  (migration `006_workout_place`; the place shows as an icon on each workout card
  and is returned by the API). Picking a place sets a sensible bodyweight default.
- **Quick-start templates** — one tap fills place, category, duration and a
  starter set list: 💪 Bodyweight · 🔥 HIIT · 🫀 Core · 🧘 Mobility · 🏃 Cardio.
  Log a home session in two taps (template → save).
- **Bodyweight mode** — a toggle that drops the kg field entirely, so a no-equipment
  session is just exercise + reps (or a hold). Weightless sets never spoof a PR,
  and the workout still earns its XP.
- **Home exercise library** merged into the set autocomplete (Liegestütze, Plank,
  Burpees, Mountain Climbers, …) so bodyweight moves are quick to type.
- Tests at **68** (new API coverage: home/bodyweight workout persists its place,
  logs weightless sets without a PR, and rejects an invalid place). SW cache -> v1.7.0.

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
