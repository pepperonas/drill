import { useEffect, useId, useRef, useState, useLayoutEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

/**
 * Accessible custom select (combobox + listbox) — replaces the native <select>.
 * The dropdown is portaled to <body> and positioned with fixed coordinates from
 * the trigger's rect (with upward flip when low on space) so it can never be
 * trapped behind sibling cards by a stacking context. Keyboard: ↑/↓, Home/End,
 * Enter/Space, Esc, type-ahead; closes on outside click; repositions on scroll.
 */
export function Select({ value, onChange, options, placeholder = 'Wählen…', ariaLabel }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [pos, setPos] = useState(null);
  const rootRef = useRef(null);
  const popRef = useRef(null);
  const listRef = useRef(null);
  const typeahead = useRef({ buf: '', t: 0 });
  const baseId = useId();

  const selectedIndex = Math.max(0, options.findIndex((o) => String(o.value) === String(value)));
  const selected = options[selectedIndex];

  const place = useCallback(() => {
    const el = rootRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const maxH = 264;
    const need = Math.min(maxH, options.length * 44 + 12);
    const spaceBelow = window.innerHeight - r.bottom;
    const up = spaceBelow < need && r.top > spaceBelow;
    setPos({
      left: Math.round(r.left), width: Math.round(r.width),
      top: up ? undefined : Math.round(r.bottom + 6),
      bottom: up ? Math.round(window.innerHeight - r.top + 6) : undefined,
    });
  }, [options.length]);

  useLayoutEffect(() => { if (open) place(); }, [open, place]);

  useEffect(() => {
    if (!open) return;
    setActive(selectedIndex);
    const onDoc = (e) => {
      if (!rootRef.current?.contains(e.target) && !popRef.current?.contains(e.target)) setOpen(false);
    };
    const onReflow = () => place();
    document.addEventListener('pointerdown', onDoc);
    window.addEventListener('scroll', onReflow, true);
    window.addEventListener('resize', onReflow);
    return () => {
      document.removeEventListener('pointerdown', onDoc);
      window.removeEventListener('scroll', onReflow, true);
      window.removeEventListener('resize', onReflow);
    };
  }, [open]); // eslint-disable-line

  useEffect(() => {
    if (open && listRef.current) listRef.current.children[active]?.scrollIntoView({ block: 'nearest' });
  }, [open, active]);

  const choose = (i) => { onChange(options[i].value); setOpen(false); };

  const onKey = (e) => {
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) { e.preventDefault(); setOpen(true); }
      return;
    }
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setOpen(false); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(options.length - 1, a + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
    else if (e.key === 'Home') { e.preventDefault(); setActive(0); }
    else if (e.key === 'End') { e.preventDefault(); setActive(options.length - 1); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(active); }
    else if (e.key.length === 1 && /\S/.test(e.key)) {
      clearTimeout(typeahead.current.t);
      typeahead.current.buf += e.key.toLowerCase();
      const i = options.findIndex((o) => o.label.toLowerCase().startsWith(typeahead.current.buf));
      if (i >= 0) setActive(i);
      typeahead.current.t = setTimeout(() => { typeahead.current.buf = ''; }, 600);
    }
  };

  return (
    <div className="sel" ref={rootRef}>
      <button
        type="button" className="sel-trigger" aria-label={ariaLabel}
        aria-haspopup="listbox" aria-expanded={open}
        aria-activedescendant={open ? `${baseId}-opt-${active}` : undefined}
        onClick={() => setOpen((o) => !o)} onKeyDown={onKey}>
        <span className={selected ? '' : 'sel-placeholder'}>{selected ? selected.label : placeholder}</span>
        <span className={'sel-caret' + (open ? ' open' : '')} aria-hidden="true">▾</span>
      </button>
      {open && pos && createPortal(
        <ul
          className="sel-pop" role="listbox" ref={(n) => { popRef.current = n; listRef.current = n; }}
          tabIndex={-1}
          style={{ position: 'fixed', left: pos.left, width: pos.width, top: pos.top, bottom: pos.bottom, right: 'auto' }}>
          {options.map((o, i) => (
            <li
              key={o.value} id={`${baseId}-opt-${i}`} role="option"
              aria-selected={i === selectedIndex}
              className={'sel-opt' + (i === active ? ' active' : '') + (i === selectedIndex ? ' selected' : '')}
              onPointerEnter={() => setActive(i)}
              onClick={() => choose(i)}>
              {o.label}
              {i === selectedIndex && <span aria-hidden="true">✓</span>}
            </li>
          ))}
        </ul>,
        document.body,
      )}
    </div>
  );
}
