/**
 * drill-api entry point. Opens the DB, builds the app, starts the HTTP server
 * and the email cron scheduler.
 */
import { config } from './config.js';
import { openDb } from './db.js';
import { createApp } from './app.js';
import { startCron } from './cron.js';

const db = openDb(config.dbPath);
const app = createApp(db);

startCron(db);

app.listen(config.port, config.host, () => {
  console.log(`[drill-api] listening on http://${config.host}:${config.port}`);
  console.log(`[drill-api] origin=${config.appOrigin} email=${config.emailEnabled ? 'on' : 'off'}`);
});
