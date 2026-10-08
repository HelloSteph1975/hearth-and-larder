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
// `active` says when to render the sheet. `print()` mounts it, waits until `ready` is true and its
// pictures have loaded, then opens the browser's print dialog. Ctrl+P mounts it too, via beforeprint.
export function usePrint({ ready = true, onAfter } = {}) {
  const [active, setActive] = useState(false);
  const [pending, setPending] = useState(false);
  const after = useRef(onAfter);
  useEffect(() => { after.current = onAfter; }, [onAfter]);

  useEffect(() => {
    const before = () => flushSync(() => setActive(true));
    const done = () => { setActive(false); setPending(false); after.current?.(); };
    window.addEventListener('beforeprint', before);
    window.addEventListener('afterprint', done);
    return () => {
      window.removeEventListener('beforeprint', before);
      window.removeEventListener('afterprint', done);
    };
  }, []);

  useEffect(() => {
    if (!pending || !ready) return undefined;
    let live = true;
    nextFrame(() => imagesSettled(document.querySelector('.print-sheet')).then(() => {
      if (!live) return;
      setPending(false);
      window.print();
    }));
    return () => { live = false; };
  }, [pending, ready]);

  const print = useCallback(() => { setActive(true); setPending(true); }, []);
  const cancel = useCallback(() => { setActive(false); setPending(false); }, []);
  return { active, preparing: pending, print, cancel };
}
