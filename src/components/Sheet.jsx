import { useEffect } from 'react';

/** Bottom sheet modal (MD3 expressive: large top radius, springy slide-up). */
export function Sheet({ open, onClose, title, children }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grab" />
        {title && <h2 className="headline" style={{ margin: '0 0 16px' }}>{title}</h2>}
        {children}
      </div>
    </div>
  );
}
