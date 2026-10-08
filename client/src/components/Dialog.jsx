import { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';

export function Dialog({ open, onClose, title, children, footer, wide = false }) {
  const ref = useRef();
  const titleId = useId();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      if (typeof d.showModal === 'function') d.showModal();
      else d.setAttribute('open', '');
    }
    if (!open && d.open) {
      if (typeof d.close === 'function') d.close();
      else d.removeAttribute('open');
    }
  }, [open]);
  return (
    <dialog ref={ref} className={`dialog${wide ? ' dialog-wide' : ''}`} onCancel={e => { e.preventDefault(); onClose(); }} aria-labelledby={titleId}>
      {open && (
        <>
          <header className="dialog-head">
            <h2 id={titleId}>{title}</h2>
            <button className="icon-btn" onClick={onClose} aria-label="Close"><X size={20} /></button>
          </header>
          <div className="dialog-body">{children}</div>
          {footer && <footer className="dialog-foot">{footer}</footer>}
        </>
      )}
    </dialog>
  );
}
