/**
 * HTML email templates — inline-styled (email clients ignore <style>/external CSS)
 * in the drill brand look: dark surface, lime accent, big rounded shapes.
 */
import { config } from './config.js';

const BRAND = '#C6FF00';     // electric lime accent
const BG = '#14160F';        // near-black surface
const CARD = '#1F2318';
const TEXT = '#E6E9DD';
const MUTED = '#9AA08C';

function shell(title, bodyHtml, token) {
  const unsub = `${config.appOrigin}/api/email/unsubscribe?token=${token}`;
  const prefs = `${config.appOrigin}/settings`;
  return `<!doctype html><html><body style="margin:0;background:${BG};padding:24px 0;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:${TEXT}">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    <table role="presentation" width="100%" style="max-width:560px" cellpadding="0" cellspacing="0">
      <tr><td style="padding:8px 8px 20px">
        <span style="font-size:26px;font-weight:800;letter-spacing:-.5px;color:${BRAND}">drill</span>
        <span style="color:${MUTED};font-size:13px;margin-left:8px">${title}</span>
      </td></tr>
      <tr><td style="background:${CARD};border-radius:28px;padding:28px">
        ${bodyHtml}
      </td></tr>
      <tr><td style="padding:18px 8px;color:${MUTED};font-size:12px;line-height:1.6">
        Du erhältst diese Mail, weil du Motivations-Mails in drill aktiviert hast.<br>
        <a href="${prefs}" style="color:${MUTED}">Einstellungen</a> &nbsp;·&nbsp;
        <a href="${unsub}" style="color:${MUTED}">Alle Mails abbestellen</a>
      </td></tr>
    </table>
  </td></tr></table>
  </body></html>`;
}

function btn(href, label) {
  return `<a href="${href}" style="display:inline-block;background:${BRAND};color:#14160F;font-weight:700;text-decoration:none;padding:14px 24px;border-radius:999px;font-size:15px">${label}</a>`;
}
function stat(value, label) {
  return `<td align="center" style="padding:8px">
    <div style="font-size:28px;font-weight:800;color:${BRAND}">${value}</div>
    <div style="font-size:12px;color:${MUTED};text-transform:uppercase;letter-spacing:.5px">${label}</div>
  </td>`;
}

export function confirmEmail({ name, token }) {
  const url = `${config.appOrigin}/api/email/confirm?token=${token}`;
  return {
    subject: 'Bestätige deine Motivations-Mails – drill',
    html: shell('Bestätigung', `
      <h1 style="margin:0 0 12px;font-size:22px">Fast geschafft, ${esc(name)}! 💪</h1>
      <p style="color:${MUTED};line-height:1.6;margin:0 0 24px">
        Bestätige kurz, dass wir dir Motivations-Mails schicken dürfen. Du kannst die
        Häufigkeit jederzeit in den Einstellungen anpassen oder alles abbestellen.</p>
      ${btn(url, 'E-Mails bestätigen')}
    `, token),
  };
}

export function weeklyEmail({ name, token, stats }) {
  const rows = [
    stat(stats.checkins, 'Check-ins'),
    stat(stats.workouts, 'Workouts'),
    stat('🔥 ' + stats.streak, 'Streak'),
    stat('Lvl ' + stats.level, 'Level'),
  ].join('');
  const wDelta = stats.weightDelta == null ? '' :
    `<p style="color:${MUTED};line-height:1.6;margin:16px 0 0">Gewicht diese Woche:
     <b style="color:${TEXT}">${stats.weightDelta > 0 ? '+' : ''}${stats.weightDelta} kg</b></p>`;
  return {
    subject: `Deine Woche bei drill: ${stats.checkins} Check-ins, +${stats.xpWeek} XP`,
    html: shell('Wochenrückblick', `
      <h1 style="margin:0 0 4px;font-size:22px">Stark, ${esc(name)}!</h1>
      <p style="color:${MUTED};line-height:1.6;margin:0 0 20px">Das war deine Woche:</p>
      <table role="presentation" width="100%"><tr>${rows}</tr></table>
      ${wDelta}
      <p style="line-height:1.6;margin:22px 0 24px">${esc(stats.message)}</p>
      ${btn(config.appOrigin + '/', 'Zum Dashboard')}
    `, token),
  };
}

export function streakAlertEmail({ name, token, streak }) {
  return {
    subject: `🔥 Deine ${streak}-Tage-Serie ist in Gefahr!`,
    html: shell('Streak in Gefahr', `
      <h1 style="margin:0 0 12px;font-size:22px">Nicht abreißen lassen, ${esc(name)}!</h1>
      <p style="color:${MUTED};line-height:1.6;margin:0 0 24px">
        Du hast eine <b style="color:${BRAND}">${streak}-Tage-Serie</b> 🔥 – aber heute noch
        keinen Check-in. Ein kurzer Eintrag genügt, um sie am Leben zu halten.</p>
      ${btn(config.appOrigin + '/', 'Jetzt einchecken')}
    `, token),
  };
}

export function dailyNudgeEmail({ name, token, line }) {
  return {
    subject: line.subject,
    html: shell('Tagesimpuls', `
      <h1 style="margin:0 0 12px;font-size:22px">${esc(line.title)}</h1>
      <p style="color:${MUTED};line-height:1.6;margin:0 0 24px">${esc(line.body)}</p>
      ${btn(config.appOrigin + '/', 'Los geht\'s')}
    `, token),
  };
}

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
