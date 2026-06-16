import { useEffect, useRef } from 'react';

/**
 * Damped cursor tilt + light tracking for a focal element (blueprint §2/§4).
 * Gated to real pointers ((hover:hover) and (pointer:fine)) and disabled under
 * reduced-motion. The rAF loop settles and STOPS when idle (no wasted frames).
 * Drives CSS custom props: --rx/--ry (rotation), --gx/--gy (light position).
 */
export function useTilt({ max = 6 } = {}) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof window === 'undefined') return;
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let rx = 0, ry = 0, gx = 50, gy = 50;          // current (eased)
    let trx = 0, tryy = 0, tgx = 50, tgy = 50;      // target
    let raf = 0, settling = false;

    const tick = () => {
      rx += (trx - rx) * 0.14; ry += (tryy - ry) * 0.14;
      gx += (tgx - gx) * 0.2;  gy += (tgy - gy) * 0.2;
      el.style.setProperty('--rx', `${rx.toFixed(2)}deg`);
      el.style.setProperty('--ry', `${ry.toFixed(2)}deg`);
      el.style.setProperty('--gx', `${gx.toFixed(1)}%`);
      el.style.setProperty('--gy', `${gy.toFixed(1)}%`);
      const done = Math.abs(trx - rx) < 0.01 && Math.abs(tryy - ry) < 0.01
        && Math.abs(tgx - gx) < 0.1 && Math.abs(tgy - gy) < 0.1;
      raf = (done && !settling) ? 0 : requestAnimationFrame(tick);
    };
    const kick = () => { if (!raf) raf = requestAnimationFrame(tick); };

    const onMove = (e) => {
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width;
      const py = (e.clientY - r.top) / r.height;
      trx = -(py - 0.5) * 2 * max;   // rotateX
      tryy = (px - 0.5) * 2 * max;   // rotateY
      tgx = px * 100; tgy = py * 100;
      settling = true; kick();
    };
    const onLeave = () => { trx = 0; tryy = 0; tgx = 50; tgy = 50; settling = false; kick(); };

    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerleave', onLeave);
    return () => {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerleave', onLeave);
      cancelAnimationFrame(raf);
    };
  }, [max]);
  return ref;
}
