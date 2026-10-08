import { useCallback, useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';

const nextFrame = fn => (window.requestAnimationFrame ? window.requestAnimationFrame(fn) : setTimeout(fn, 16));

// Resolves once every picture in the sheet has loaded or failed, or after `timeout` ms.
export function imagesSettled(root, timeout = 3000) {
  const waiting = [...(root?.querySelectorAll('img') ?? [])].filter(img => !img.complete);
  if (!waiting.length) return Promise.resolve();
  const one = img => new Promise(res => {
    img.addEventListener('load', res, { once: true });
    img.addEventListener('error', res, { once: true });
  });
  return Promise.race([Promise.all(waiting.map(one)), new Promise(res => setTimeout(res, timeout))]);
}

// Print sheets are mounted only while printing, so the screen and its tests never carry a second copy.
// `active` says when to render the sheet; `ready` says whether the data behind it matches what the
// screen shows. Render the sheet only when both are true (PrintGate does this, and prints a
// "still loading" note otherwise), so Ctrl+P never puts last week's meals under this week's dates.
// `print()` mounts the sheet, waits for `ready` and the sheet's pictures, then opens the print
// dialog. A queued print is dropped if loading fails or the view changes (`viewKey`), so a later
// load can't open the dialog unasked.
export function usePrint({ ready = true, failed = false, viewKey = '', onAfter } = {}) {
  const [active, setActive] = useState(false);
  const [pendingKey, setPendingKey] = useState(null);
  const pending = pendingKey !== null;
  const after = useRef(onAfter);
  useEffect(() => { after.current = onAfter; }, [onAfter]);

  useEffect(() => {
    const before = () => flushSync(() => setActive(true));
    const done = () => { setActive(false); setPendingKey(null); after.current?.(); };
    window.addEventListener('beforeprint', before);
    window.addEventListener('afterprint', done);
    return () => {
      window.removeEventListener('beforeprint', before);
      window.removeEventListener('afterprint', done);
    };
  }, []);

  const dropped = pending && (failed || pendingKey !== viewKey);
  useEffect(() => {
    if (!dropped) return;
    setPendingKey(null);
    setActive(false);
  }, [dropped]);

  useEffect(() => {
    if (!pending || dropped || !ready) return undefined;
    let live = true;
    nextFrame(() => imagesSettled(document.querySelector('.print-sheet')).then(() => {
      if (!live) return;
      setPendingKey(null);
      window.print();
    }));
    return () => { live = false; };
  }, [pending, dropped, ready]);

  const print = useCallback(() => { setActive(true); setPendingKey(viewKey); }, [viewKey]);
  const cancel = useCallback(() => { setActive(false); setPendingKey(null); }, []);
  return { active, ready: Boolean(ready), preparing: pending && !dropped, print, cancel };
}
