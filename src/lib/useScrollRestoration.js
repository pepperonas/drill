import { useEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

/**
 * Premium navigation feel (blueprint §5): take over scroll restoration so that
 * - forward (PUSH/REPLACE) lands at the top and plays the entrance animation,
 * - back/forward (POP) restores the exact previous scroll position instantly and
 *   does NOT replay entrances.
 * Returns the navigation type so the caller can gate the entrance animation.
 */
export function useScrollRestoration() {
  const loc = useLocation();
  const navType = useNavigationType(); // 'POP' | 'PUSH' | 'REPLACE'
  const positions = useRef(new Map());

  useEffect(() => {
    if ('scrollRestoration' in window.history) window.history.scrollRestoration = 'manual';
  }, []);

  // Continuously remember where we are on the current history entry (also mirror
  // to sessionStorage so it survives a reload).
  useEffect(() => {
    const key = loc.key;
    const onScroll = () => {
      positions.current.set(key, window.scrollY);
      try { sessionStorage.setItem(`drill_sy_${key}`, String(window.scrollY)); } catch { /* ignore */ }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [loc.key]);

  useEffect(() => {
    if (navType !== 'POP') { window.scrollTo(0, 0); return; }

    let y = positions.current.get(loc.key);
    if (y == null) { const s = Number(sessionStorage.getItem(`drill_sy_${loc.key}`)); y = Number.isFinite(s) ? s : 0; }

    // Async pages (charts, fetched data) grow after mount — retry restoring until
    // the document is tall enough to honor the saved position (no animated scroll).
    let frame = 0, raf = 0;
    const restore = () => {
      const max = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
      window.scrollTo(0, Math.min(y, max));
      frame++;
      if (max < y - 2 && frame < 60) raf = requestAnimationFrame(restore);
    };
    raf = requestAnimationFrame(restore);
    return () => cancelAnimationFrame(raf);
  }, [loc.key]); // eslint-disable-line react-hooks/exhaustive-deps

  return navType;
}
