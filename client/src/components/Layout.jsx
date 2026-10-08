import { useEffect, useRef, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { Sidebar, Brand } from './Sidebar.jsx';

export function Layout() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();

  const mainRef = useRef(null);
  const lastPath = useRef(pathname);

  useEffect(() => {
    setOpen(false);
    // Move focus to the new page for keyboard and screen-reader users, but not on first load
    // (comparing paths also survives StrictMode's double effect run).
    if (lastPath.current === pathname) return;
    lastPath.current = pathname;
    mainRef.current?.focus({ preventScroll: true });
  }, [pathname]);
  useEffect(() => {
    if (!open) return undefined;
    const onKey = e => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">Skip to content</a>
      <header className="topbar gingham">
        <Brand />
        <button className="icon-btn topbar-menu" aria-expanded={open} aria-controls="site-nav"
          aria-label={open ? 'Close menu' : 'Open menu'} onClick={() => setOpen(o => !o)}>
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </header>
      <Sidebar id="site-nav" open={open} />
      {open && <div className="scrim" onClick={() => setOpen(false)} aria-hidden="true" />}
      <main id="main" className="main" tabIndex={-1} ref={mainRef}>
        <div className="page">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
