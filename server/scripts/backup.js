/**
 * Simple online backup of the SQLite DB using better-sqlite3's backup API.
 * Run via the drill-backup.timer (see deploy docs) or `npm run backup`.
 */
import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { config } from '../config.js';

const OUT_DIR = process.env.BACKUP_DIR || '/var/backups/drill';
mkdirSync(OUT_DIR, { recursive: true });

const stamp = new Intl.DateTimeFormat('en-CA', {
  timeZone: config.tz, year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date());

const dest = `${OUT_DIR}/drill-${stamp}.db`;
const db = new Database(config.dbPath, { readonly: true });
await db.backup(dest);
db.close();
console.log('[backup] wrote ' + dest);
