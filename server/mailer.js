/**
 * Email sending via nodemailer (Hostinger SMTP). Lazily creates the transport.
 * If SMTP creds are absent (config.emailEnabled === false), send() is a no-op
 * that logs, so the app runs fine in dev without email.
 */
import nodemailer from 'nodemailer';
import { config } from './config.js';

let transport = null;
function getTransport() {
  if (transport) return transport;
  transport = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.secure,
    auth: { user: config.smtp.user, pass: config.smtp.pass },
  });
  return transport;
}

export async function sendMail({ to, subject, html, text }) {
  if (!config.emailEnabled) {
    console.log(`[mail:disabled] would send "${subject}" to ${to}`);
    return { skipped: true };
  }
  const msg = {
    from: config.smtp.from,
    to,
    subject,
    text: text || html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
    html,
  };
  if (config.smtp.bcc) msg.bcc = config.smtp.bcc;
  return getTransport().sendMail(msg);
}
