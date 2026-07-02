/**
 * Device pairing for the native companion app.
 *
 * The web app (already logged in) calls POST /pairing/start to mint a short-lived,
 * single-use code. The app posts that code to the PUBLIC /pairing/claim endpoint
 * and receives an opaque device token; only the token's SHA-256 hash is stored
 * (see auth.requireUser for how the Bearer token is matched). Tokens are revocable.
 */
import express from 'express';
import { randomBytes, createHash } from 'node:crypto';

const sha256 = (s) => createHash('sha256').update(String(s)).digest('hex');

// Unambiguous alphabet (no 0/O/1/I) so codes are easy to read/type.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function genCode(len = 6) {
  const bytes = randomBytes(len);
  let out = '';
  for (let i = 0; i < len; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

export function pairingRoutes(db, auth) {
  const r = express.Router();
  const now = () => Math.floor(Date.now() / 1000);

  // Web (authed): issue a pairing code, valid 10 minutes, single use.
  r.post('/pairing/start', auth.requireUser, (req, res) => {
    const created = now();
    const expires = created + 600;
    // Retry on the (astronomically unlikely) code collision.
    let code = null;
    for (let i = 0; i < 5; i++) {
      const c = genCode(6);
      if (!db.getPairing.get(c)) { code = c; break; }
    }
    if (!code) return res.status(503).json({ error: 'try_again' });
    db.insertPairing.run({ code, user_id: req.user.id, now: created, expires });
    res.json({ code, expires_at: expires });
  });

  // App (public): exchange a valid code for an opaque device token.
  r.post('/pairing/claim', (req, res) => {
    const b = req.body || {};
    const code = String(b.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!code) return res.status(400).json({ error: 'code_required' });
    const p = db.getPairing.get(code);
    if (!p || p.consumed || p.expires_at < now()) {
      return res.status(400).json({ error: 'invalid_or_expired' });
    }
    db.consumePairing.run(code);
    const token = randomBytes(32).toString('hex');
    const name = String(b.device_name || 'Android-Gerät').slice(0, 60);
    db.insertDeviceToken.run({ user_id: p.user_id, name, token_hash: sha256(token), now: now() });
    const u = db.getUserById.get(p.user_id);
    res.json({ token, user: { name: u.name, email: u.email } });
  });

  // Web (authed): list paired devices.
  r.get('/pairing/devices', auth.requireUser, (req, res) => {
    res.json({ devices: db.listDevices.all(req.user.id) });
  });

  // Web (authed): revoke a device.
  r.post('/pairing/devices/:id/revoke', auth.requireUser, (req, res) => {
    db.revokeDevice.run(Number(req.params.id), req.user.id);
    res.json({ ok: true });
  });

  return r;
}
