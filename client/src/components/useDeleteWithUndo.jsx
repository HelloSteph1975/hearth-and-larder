import { useConfirm } from './ConfirmProvider.jsx';
import { useToast } from './ToastProvider.jsx';
import { api } from '../lib/api.js';

export function useDeleteWithUndo() {
  const confirm = useConfirm();
  const toast = useToast();
  return async ({ url, label, onChange, body = 'You can undo this for a few seconds afterward.' }) => {
    const ok = await confirm({ title: `Delete ${label}?`, body, confirmLabel: 'Delete', danger: true });
    if (!ok) return false;
    try {
      const res = await api.del(url);
      onChange?.();
      toast.show({
        message: `Deleted ${label}`,
        duration: 8000,
        action: {
          label: 'Undo',
          onClick: async () => {
            try {
              await api.post(res.restore);
              onChange?.();
              toast.show({ message: `Brought back ${label}` });
            } catch (err) {
              toast.show({ message: err.message, duration: 6000 });
            }
          },
        },
      });
      return true;
    } catch (err) {
      toast.show({ message: err.message, duration: 6000 });
      return false;
    }
  };
}
