/**
 * Central configuration. Loads ./.env (minimal dotenv) unless already in env,
 * then exposes typed config values. Fails fast on missing required secrets.
 */
import { readFileSync, existsSync } from 'node:fs';

function loadEnv() {
  const file = process.env.ENV_FILE || './.env';
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (!m) continue;
    if (process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
    }
  }
}
loadEnv();

function required(name) {
  const v = process.env[name];
  if (!v || v.startsWith('your-') || v.includes('replace-')) {
    console.error(`[config] Missing or placeholder env var: ${name}`);
    process.exit(1);
  }
  return v;
}

export const config = {
  port: parseInt(process.env.PORT || '4252', 10),
  host: process.env.HOST || '127.0.0.1',
  dbPath: process.env.DB_PATH || './data/drill.db',

  google: {
    clientId: required('GOOGLE_CLIENT_ID'),
    clientSecret: required('GOOGLE_CLIENT_SECRET'),
    redirectUri: required('OAUTH_REDIRECT_URI'),
  },

  appOrigin: required('APP_ORIGIN'),
  // Secure cookies require HTTPS; relax for local http dev origins.
  cookieSecure: required('APP_ORIGIN').startsWith('https'),
  sessionSecret: required('SESSION_SECRET'),
  sessionCookie: process.env.SESSION_COOKIE || 'drill_session',
  sessionTtl: parseInt(process.env.SESSION_TTL || '2592000', 10), // 30d
  stateCookie: 'drill_oauth_state',
  stateTtl: 600,

  adminEmails: new Set(
    (process.env.ADMIN_EMAILS || 'martinpaush@gmail.com')
      .split(',').map(e => e.trim().toLowerCase()).filter(Boolean)
  ),

  // SMTP (Hostinger) — optional; if absent, email features are disabled.
  smtp: {
    host: process.env.SMTP_HOST || 'smtp.hostinger.com',
    port: parseInt(process.env.SMTP_PORT || '465', 10),
    secure: (process.env.SMTP_SECURE ?? 'true') !== 'false',
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || 'drill <support@celox.io>',
    bcc: process.env.SMTP_BCC || '',
  },
  emailEnabled: !!(process.env.SMTP_USER && process.env.SMTP_PASS),

  // Timezone used for streak/day boundaries and cron schedules.
  tz: process.env.TZ_NAME || 'Europe/Berlin',
};

export const BOOT_TIME = Date.now();
