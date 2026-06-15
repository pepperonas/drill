/**
 * One-off / maintenance repair: deterministically rebuild every user's XP ledger
 * from their current data (fixes accounts that drifted from legacy deletes that
 * didn't reverse XP). Safe to re-run — it's idempotent.
 *
 *   cd /opt/drill-api && node scripts/rebuild-xp.js        # all users
 *   cd /opt/drill-api && node scripts/rebuild-xp.js 1      # only user id 1
 */
import { config } from '../config.js';
import { openDb } from '../db.js';
import { rebuildXp } from '../gamification.js';

const db = openDb(config.dbPath);
const arg = process.argv[2];
const users = arg
  ? [db.getUserById.get(Number(arg))].filter(Boolean)
  : db.allConfirmedUsers.all();

for (const u of users) {
  const before = `${u.xp}xp/L${u.level}/streak${u.streak_current}`;
  const r = rebuildXp(db, u);
  console.log(`user ${u.id} <${u.email}>: ${before} -> ${r.xp}xp/L${r.level}/streak${r.streak}`);
}
console.log(`[rebuild-xp] done (${users.length} user(s))`);
