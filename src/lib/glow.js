/**
 * Cursor-following highlight glow on widget cards/tiles (blueprint §4 — light
 * tracks the cursor). One delegated pointermove listener; per frame it reads the
 * hovered element's rect once and writes only CSS custom props (--mx/--my), so
 * there's no layout thrash. Gated to real pointers and disabled under
 * reduced-motion. Applies to all widget cards/tiles, including the tilting hero
 * (which adds 3D rotation on top via lib/useTilt.js).
 */
const SELECTOR = '.card, .tile';

export function installGlow() {
  if (typeof document === 'undefined') return;
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  let current = null, mx = 0, my = 0, raf = 0;

  const flush = () => {
    raf = 0;
    if (!current) return;
    const r = current.getBoundingClientRect();
    if (!r.width || !r.height) return;
    current.style.setProperty('--mx', `${(((mx - r.left) / r.width) * 100).toFixed(1)}%`);
    current.style.setProperty('--my', `${(((my - r.top) / r.height) * 100).toFixed(1)}%`);
  };

  const clear = () => { if (current) { current.classList.remove('glow-on'); current = null; } };

  document.addEventListener('pointermove', (e) => {
    const el = e.target.closest(SELECTOR);
    if (el !== current) {
      if (current) current.classList.remove('glow-on');
      current = el;
      if (current) current.classList.add('glow-on');
    }
    if (!current) return;
    mx = e.clientX; my = e.clientY;
    if (!raf) raf = requestAnimationFrame(flush);
  }, { passive: true });

  document.addEventListener('pointerleave', clear);
  // a card scrolling out from under a still cursor shouldn't keep glowing
  window.addEventListener('scroll', clear, { passive: true });
}
