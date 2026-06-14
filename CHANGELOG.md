# Changelog

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
