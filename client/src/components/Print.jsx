import { useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { Printer } from 'lucide-react';
import { Button } from './Button.jsx';
import { prettyDate, todayISO } from '../lib/dates.js';

// With no onClick it prints the page as it stands, like the shopping list does.
export function PrintButton({ children = 'Print', onClick, busy = false, disabled = false, variant = 'ghost', ...props }) {
  return (
    <Button variant={variant} icon={Printer} onClick={onClick ?? (() => window.print())} disabled={busy || disabled} aria-busy={busy || undefined} {...props}>
      {busy ? 'Preparing…' : children}
    </Button>
  );
}

export function printedOn(iso = todayISO()) {
  return `${prettyDate(iso)} ${iso.slice(0, 4)}`;
}

export function PrintHeader({ what, className = '' }) {
  return (
    <div className={`print-head ${className}`.trim()}>
      <p className="print-wordmark">Hearth &amp; Larder</p>
      {what && <p className="print-what">{what}</p>}
      <p className="print-date">Printed {printedOn()}</p>
    </div>
  );
}

export function PrintFooter() {
  return <p className="print-foot">from the Hearth &amp; Larder kitchen book</p>;
}

// The paper version of a screen. It lives outside the app so print can hide everything else.
export function PrintSheet({ what, children, className = '', bare = false }) {
  useLayoutEffect(() => {
    document.body.classList.add('has-print-sheet');
    return () => document.body.classList.remove('has-print-sheet');
  }, []);
  return createPortal(
    <div className={`print-sheet ${className}`.trim()} data-testid="print-sheet">
      {!bare && <PrintHeader what={what} />}
      {children}
      {!bare && <PrintFooter />}
    </div>,
    document.body,
  );
}

// Renders a screen's print sheet only while printing, and only from data that matches the screen.
// `children` is a function so it never runs against data that hasn't arrived.
export function PrintGate({ printer, what, className, bare = false, children }) {
  if (!printer.active) return null;
  if (!printer.ready) {
    return (
      <PrintSheet what={what}>
        <p className="print-wait" role="status">Still loading. Please print again in a moment.</p>
      </PrintSheet>
    );
  }
  return <PrintSheet what={what} className={className} bare={bare}>{children()}</PrintSheet>;
}
