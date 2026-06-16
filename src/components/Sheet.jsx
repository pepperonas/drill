import { useEffect, useRef } from 'react';

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),textarea:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

/**
 * Bottom-sheet dialog (M3 expressive: large top radius, springy slide-up).
 * Accessible: role=dialog, scroll-locked body, Esc to close, focus trapped
 * inside while open, and focus returned to the trigger on close (blueprint §8).
 */
export function Sheet({ open, onClose, title, children }) {
  const ref = useRef(null);
  const triggerRef = useRef(null);
  const wasOpen = useRef(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose; // keep latest without re-running the effect

  // Capture the opening element during render — before the sheet's children mount
  // and a child autoFocus can steal the active element.
  if (open && !wasOpen.current && typeof document !== 'undefined') triggerRef.current = document.activeElement;
  wasOpen.current = open;

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // initial focus: first focusable inside, else the sheet itself
    const focusFirst = () => {
      const node = ref.current;
      if (!node) return;
      const f = node.querySelector(FOCUSABLE);
      (f || node).focus({ preventScroll: true });
    };
    const raf = requestAnimationFrame(focusFirst);

    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); onCloseRef.current(); return; }
      if (e.key !== 'Tab') return;
      const items = ref.current?.querySelectorAll(FOCUSABLE);
      if (!items || !items.length) { e.preventDefault(); return; }
      const first = items[0], last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      // Return focus to the trigger — deferred so it lands AFTER React removes the
      // sheet DOM (a synchronous focus gets reset to <body>); retried once in case
      // a follow-up re-render steals it.
      const trigger = triggerRef.current;
      const refocus = () => { try { trigger?.focus({ preventScroll: true }); } catch { /* gone */ } };
      requestAnimationFrame(refocus);
      setTimeout(refocus, 90);
    };
  }, [open]);

  if (!open) return null;
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title || 'Dialog'}
        tabIndex={-1} ref={ref} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grab" />
        {title && <h2 className="headline" style={{ margin: '0 0 16px' }}>{title}</h2>}
        {children}
      </div>
    </div>
  );
}
