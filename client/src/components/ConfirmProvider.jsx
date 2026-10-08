import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { Dialog } from './Dialog.jsx';
import { Button } from './Button.jsx';

const Ctx = createContext(null);
export const useConfirm = () => useContext(Ctx);

export function ConfirmProvider({ children }) {
  const [req, setReq] = useState(null);
  const pending = useRef(null);
  const confirm = useCallback(opts => new Promise(resolve => {
    // A newer question replaces an unanswered one; the old caller gets "no".
    pending.current?.resolve(false);
    const next = { ...opts, resolve };
    pending.current = next;
    setReq(next);
  }), []);
  const done = ok => {
    const current = pending.current;
    pending.current = null;
    setReq(null);
    current?.resolve(ok);
  };
  return (
    <Ctx.Provider value={confirm}>
      {children}
      <Dialog open={Boolean(req)} onClose={() => done(false)} title={req?.title ?? ''}
        footer={req && (
          <>
            <Button variant="ghost" onClick={() => done(false)}>Keep it</Button>
            <Button variant={req.danger ? 'danger' : 'primary'} onClick={() => done(true)} autoFocus>{req.confirmLabel ?? 'OK'}</Button>
          </>
        )}>
        {req?.body && <p>{req.body}</p>}
      </Dialog>
    </Ctx.Provider>
  );
}
