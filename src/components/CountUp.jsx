import { useState, useEffect, useRef } from 'react';

const prefersReduced = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Animate an integer from 0 to `value` with an easeOutCubic ramp on mount/change. */
export function useCountUp(value, duration = 900) {
  const [n, setN] = useState(prefersReduced() ? value : 0);
  const raf = useRef(0);
  useEffect(() => {
    if (prefersReduced()) { setN(value); return; }
    const from = 0, start = performance.now();
    cancelAnimationFrame(raf.current);
    const tick = (t) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setN(Math.round(from + (value - from) * eased));
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [value, duration]);
  return n;
}

/** Animated number. `prefix`/`suffix` are static; only the number counts up. */
export function CountUp({ value, prefix = '', suffix = '', duration = 900 }) {
  const n = useCountUp(Number(value) || 0, duration);
  return <span className="mono-num">{prefix}{n}{suffix}</span>;
}
