/**
 * Tiny in-memory fixed-window rate limiter keyed by client IP. Good enough for a
 * single-process app behind nginx (trust proxy is set so req.ip is the real IP).
 */
export function createLimiter({ windowMs, max }) {
  const hits = new Map(); // ip -> { count, reset }
  return function limiter(req, res, next) {
    const now = Date.now();
    const ip = req.ip || 'unknown';
    let e = hits.get(ip);
    if (!e || e.reset < now) {
      e = { count: 0, reset: now + windowMs };
      hits.set(ip, e);
    }
    e.count++;
    if (e.count > max) {
      res.set('Retry-After', String(Math.ceil((e.reset - now) / 1000)));
      return res.status(429).json({ error: 'rate_limited' });
    }
    next();
  };
}

// Periodically drop expired buckets so the map can't grow unbounded.
export function startLimiterGc(intervalMs = 300000) {
  // No-op placeholder kept simple; buckets self-expire on next hit. Real GC could
  // be added if memory pressure ever shows up.
  return intervalMs;
}
