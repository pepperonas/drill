import { useEffect, useId, useRef, useState } from 'react';

/**
 * Accessible custom select (combobox + listbox) — replaces the native <select>,
 * which is the loudest "unstyled" tell. Keyboard: ↑/↓ move, Home/End, Enter/Space
 * select, Esc close, type-ahead. Closes on outside click; focus stays on the
 * trigger via aria-activedescendant. Honors focus-visible.
 *
 * Props: value, onChange(value), options [{value,label}], placeholder, ariaLabel.
 */
export function Select({ value, onChange, options, placeholder = 'Wählen…', ariaLabel }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const rootRef = useRef(null);
  const listRef = useRef(null);
  const typeahead = useRef({ buf: '', t: 0 });
  const baseId = useId();

  const selectedIndex = Math.max(0, options.findIndex((o) => String(o.value) === String(value)));
  const selected = options[selectedIndex];

  useEffect(() => {
    if (!open) return;
    setActive(selectedIndex);
    const onDoc = (e) => { if (!rootRef.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('pointerdown', onDoc);
    return () => document.removeEventListener('pointerdown', onDoc);
  }, [open]); // eslint-disable-line

  useEffect(() => {
    if (open && listRef.current) {
      const el = listRef.current.children[active];
      el?.scrollIntoView({ block: 'nearest' });
    }
  }, [open, active]);

  const choose = (i) => { onChange(options[i].value); setOpen(false); };

  const onKey = (e) => {
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) { e.preventDefault(); setOpen(true); }
      return;
    }
    if (e.key === 'Escape') { e.preventDefault(); setOpen(false); }
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
      {open && (
        <ul className="sel-pop" role="listbox" ref={listRef} tabIndex={-1}>
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
        </ul>
      )}
    </div>
  );
}
