/**
 * Material-style touch ripple. Installed once; a delegated pointerdown listener
 * spawns an expanding ink circle from the press point on interactive surfaces.
 * Honors prefers-reduced-motion and skips disabled elements.
 */
const SELECTOR = '.btn, .chip, .nav-item, .fab, .tile, .card.tap';

export function installRipple() {
  if (typeof document === 'undefined') return;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');

  document.addEventListener('pointerdown', (e) => {
    if (reduce.matches || (e.button && e.button !== 0)) return;
    const el = e.target.closest(SELECTOR);
    if (!el || el.disabled || el.getAttribute('aria-disabled') === 'true') return;

    const rect = el.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height) * 2;
    const ink = document.createElement('span');
    ink.className = 'ripple-ink';
    ink.style.width = ink.style.height = `${size}px`;
    ink.style.left = `${e.clientX - rect.left - size / 2}px`;
    ink.style.top = `${e.clientY - rect.top - size / 2}px`;
    if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
    el.appendChild(ink);
    ink.addEventListener('animationend', () => ink.remove(), { once: true });
  }, { passive: true });
}
