/**
 * Google OAuth (authorization-code flow) without an SDK + session middleware.
 * ID tokens are verified via Google's tokeninfo endpoint (no JWKS handling).
 */
import { randomBytes, createHash } from 'node:crypto';
import { config } from './config.js';
import { sign, verify } from './session.js';

const sha256 = (s) => createHash('sha256').update(String(s)).digest('hex');

function cookieOpts(maxAgeSeconds) {
  return { httpOnly: true, secure: config.cookieSecure, sameSite: 'lax', path: '/', maxAge: maxAgeSeconds * 1000 };
}

export function makeAuth(db) {
  function requireUser(req, res, next) {
    // 1) Browser session cookie (web app).
    const payload = verify(req.cookies[config.sessionCookie], config.sessionSecret);
    if (payload && payload.uid) {
      const user = db.getUserById.get(payload.uid);
      if (user) { req.user = user; return next(); }
    }
    // 2) Device bearer token (native app) — opaque token, matched by its hash.
    const m = /^Bearer\s+(.+)$/i.exec(req.headers.authorization || '');
    if (m) {
      const dev = db.deviceByHash.get(sha256(m[1].trim()));
      if (dev && !dev.revoked) {
        const user = db.getUserById.get(dev.user_id);
        if (user) {
          db.touchDevice.run(Math.floor(Date.now() / 1000), dev.id);
          req.user = user;
          req.deviceId = dev.id;
          return next();
        }
      }
    }
    return res.status(401).json({ error: 'unauthenticated' });
  }

  function startOAuth(req, res) {
    const state = randomBytes(16).toString('hex');
    res.cookie(config.stateCookie, state, cookieOpts(config.stateTtl));
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.searchParams.set('client_id', config.google.clientId);
    url.searchParams.set('redirect_uri', config.google.redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', 'openid email profile');
    url.searchParams.set('state', state);
    url.searchParams.set('prompt', 'select_account');
    res.redirect(url.toString());
  }

  async function oauthCallback(req, res) {
    try {
      const { code, state, error } = req.query;
      if (error) return res.redirect(config.appOrigin + '/?auth_error=' + encodeURIComponent(String(error)));
      if (!code || !state) return res.status(400).send('Missing code or state');
      const cookieState = req.cookies[config.stateCookie];
      if (!cookieState || cookieState !== state) return res.status(400).send('State mismatch');
      res.clearCookie(config.stateCookie, { path: '/' });

      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code: String(code),
          client_id: config.google.clientId,
          client_secret: config.google.clientSecret,
          redirect_uri: config.google.redirectUri,
          grant_type: 'authorization_code',
        }),
      });
      const tokens = await tokenRes.json();
      if (!tokenRes.ok || !tokens.id_token) {
        console.error('Token exchange failed:', tokens);
        return res.status(502).send('Token exchange failed');
      }

      const infoRes = await fetch(
        'https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(tokens.id_token));
      const info = await infoRes.json();
      if (!infoRes.ok || info.aud !== config.google.clientId || !info.sub || !info.email) {
        console.error('Token verification failed:', info);
        return res.status(502).send('Token verification failed');
      }

      const now = Math.floor(Date.now() / 1000);
      const user = db.upsertUser.get({
        google_sub: info.sub,
        email: info.email,
        name: info.name || info.email.split('@')[0],
        picture: info.picture || null,
        now,
      });

      const exp = now + config.sessionTtl;
      res.cookie(config.sessionCookie, sign({ uid: user.id, exp }, config.sessionSecret),
        cookieOpts(config.sessionTtl));
      res.redirect(config.appOrigin + '/');
    } catch (err) {
      console.error('Callback error:', err);
      res.status(500).send('Internal error');
    }
  }

  function logout(req, res) {
    res.clearCookie(config.sessionCookie, { path: '/' });
    res.json({ ok: true });
  }

  return { requireUser, startOAuth, oauthCallback, logout };
}
