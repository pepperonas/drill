/**
 * Schema migrations. Each migration runs once, tracked in `schema_migrations`.
 * Add new migrations to the END of the array; never edit an applied one.
 *
 * Day-keyed rows use `day` as 'YYYY-MM-DD' in the user's local timezone so that
 * streaks and "today" line up with how the user experiences their day.
 */
export function runMigrations(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    applied_at INTEGER NOT NULL
  )`);

  const applied = new Set(db.prepare('SELECT name FROM schema_migrations').all().map(r => r.name));
  const out = [];
  const now = () => Math.floor(Date.now() / 1000);

  for (const [name, sql] of MIGRATIONS) {
    if (applied.has(name)) continue;
    db.transaction(() => {
      db.exec(sql);
      db.prepare('INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)').run(name, now());
    })();
    out.push(name);
  }
  return out;
}

const MIGRATIONS = [
  ['001_init', `
    CREATE TABLE users (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      google_sub    TEXT UNIQUE NOT NULL,
      email         TEXT NOT NULL,
      name          TEXT,
      picture       TEXT,
      tz            TEXT NOT NULL DEFAULT 'Europe/Berlin',
      created_at    INTEGER NOT NULL,
      last_seen_at  INTEGER NOT NULL,
      -- gamification rollup (denormalized for cheap reads)
      xp            INTEGER NOT NULL DEFAULT 0,
      level         INTEGER NOT NULL DEFAULT 1,
      streak_current INTEGER NOT NULL DEFAULT 0,
      streak_best   INTEGER NOT NULL DEFAULT 0,
      last_checkin_day TEXT
    );

    -- Generic metric time-series: weight, bodyfat, waist, chest, arm, custom...
    CREATE TABLE metrics (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      kind      TEXT NOT NULL,          -- 'weight' | 'bodyfat' | 'waist' | ... | custom slug
      value     REAL NOT NULL,
      unit      TEXT,                   -- 'kg' | '%' | 'cm' ...
      day       TEXT NOT NULL,          -- 'YYYY-MM-DD'
      note      TEXT,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX idx_metrics_user_kind_day ON metrics(user_id, kind, day);

    -- Attendance / activity check-in (one per day per user).
    CREATE TABLE checkins (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      day       TEXT NOT NULL,
      kind      TEXT NOT NULL DEFAULT 'gym',  -- gym | sport | home | rest
      note      TEXT,
      created_at INTEGER NOT NULL,
      UNIQUE(user_id, day)
    );

    -- Training session + its sets.
    CREATE TABLE workouts (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      day        TEXT NOT NULL,
      category   TEXT,                  -- push/pull/legs/cardio/...
      title      TEXT,
      duration_min INTEGER,
      note       TEXT,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX idx_workouts_user_day ON workouts(user_id, day);

    CREATE TABLE workout_sets (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      workout_id INTEGER NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
      exercise   TEXT NOT NULL,
      weight     REAL,                  -- kg
      reps       INTEGER,
      sort       INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX idx_sets_workout ON workout_sets(workout_id);

    -- Nutrition: either detailed (kcal/macros) or a simple quality score.
    CREATE TABLE nutrition_logs (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      day       TEXT NOT NULL,
      kcal      INTEGER,
      protein_g INTEGER,
      carbs_g   INTEGER,
      fat_g     INTEGER,
      quality   INTEGER,               -- 1..5 self-rated "ate well"
      water_ml  INTEGER,
      note      TEXT,
      created_at INTEGER NOT NULL,
      UNIQUE(user_id, day)
    );

    -- Gamification: append-only XP ledger + unlocked achievements.
    CREATE TABLE xp_events (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      amount    INTEGER NOT NULL,
      reason    TEXT NOT NULL,
      day       TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX idx_xp_user ON xp_events(user_id, created_at);

    CREATE TABLE user_achievements (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      code      TEXT NOT NULL,
      unlocked_at INTEGER NOT NULL,
      UNIQUE(user_id, code)
    );

    -- Email preferences + token for unsubscribe links + dedupe log.
    CREATE TABLE email_prefs (
      user_id      INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      weekly       INTEGER NOT NULL DEFAULT 0,  -- opt-in required (double opt-in)
      streak_alert INTEGER NOT NULL DEFAULT 0,
      daily_nudge  INTEGER NOT NULL DEFAULT 0,
      confirmed    INTEGER NOT NULL DEFAULT 0,  -- email verified / opted-in
      token        TEXT NOT NULL,               -- unsubscribe + confirm token
      updated_at   INTEGER NOT NULL
    );

    CREATE TABLE email_log (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type      TEXT NOT NULL,        -- weekly | streak_alert | daily_nudge | confirm
      day       TEXT NOT NULL,
      sent_at   INTEGER NOT NULL,
      UNIQUE(user_id, type, day)
    );
  `],
];
