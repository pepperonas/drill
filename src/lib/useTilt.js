import { useCallback, useRef } from 'react';

/**
 * Damped cursor tilt for a focal element (blueprint §2/§4) — 3D rotation toward
 * the pointer. Returns a CALLBACK ref so it binds whenever the element actually
 * mounts (the hero renders only after data loads, so an effect-on-mount would
 * miss it). Gated to real pointers + disabled under reduced-motion; the rAF loop
 * settles and STOPS when idle. Drives CSS props --rx/--ry. (The tracking light is
 * handled separately by lib/glow.js → --mx/--my.)
 */
export function useTilt({ max = 6 } = {}) {
  const cleanup = useRef(null);

  return useCallback((el) => {
    // detach from a previous element
    if (cleanup.current) { cleanup.current(); cleanup.current = null; }
    if (!el || typeof window === 'undefined') return;
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let rx = 0, ry = 0, trx = 0, tryy = 0, raf = 0, settling = false;
    const tick = () => {
      rx += (trx - rx) * 0.14; ry += (tryy - ry) * 0.14;
      el.style.setProperty('--rx', `${rx.toFixed(2)}deg`);
      el.style.setProperty('--ry', `${ry.toFixed(2)}deg`);
      const done = Math.abs(trx - rx) < 0.01 && Math.abs(tryy - ry) < 0.01;
      raf = (done && !settling) ? 0 : requestAnimationFrame(tick);
    };
    const kick = () => { if (!raf) raf = requestAnimationFrame(tick); };
    const onMove = (e) => {
      const r = el.getBoundingClientRect();
      trx = -(((e.clientY - r.top) / r.height) - 0.5) * 2 * max;
      tryy = (((e.clientX - r.left) / r.width) - 0.5) * 2 * max;
      settling = true; kick();
    };
    const onLeave = () => { trx = 0; tryy = 0; settling = false; kick(); };

    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerleave', onLeave);
    cleanup.current = () => {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerleave', onLeave);
      cancelAnimationFrame(raf);
    };
  }, [max]);
}
