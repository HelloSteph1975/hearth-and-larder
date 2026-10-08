import { useEffect, useState } from 'react';
import { Dialog } from '../components/Dialog.jsx';
import { Button } from '../components/Button.jsx';
import { Field, DateInput, TextArea } from '../components/Field.jsx';
import { api } from '../lib/api.js';
import { formatQty } from '../lib/format.js';
import { todayISO } from '../lib/dates.js';
import { useToast } from '../components/ToastProvider.jsx';

// onChanged runs after an Undo puts the stock back, so the page can refresh.
export function CookDialog({ open, recipe, servings, onClose, onDone, onChanged }) {
  const [plan, setPlan] = useState(null);
  const [lines, setLines] = useState([]);
  const [cookedOn, setCookedOn] = useState(todayISO());
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  useEffect(() => {
    if (!open) return undefined;
    let live = true;
    setPlan(null);
    setLines([]);
    setCookedOn(todayISO());
    setNotes('');
    api.post(`/api/recipes/${recipe.id}/cook/preview`, { servings }).then(p => {
      if (!live) return;
      setPlan(p);
      setLines(p.deductions.map(d => ({ ...d, use: true })));
    }, err => live && toast.show({ message: err.message }));
    return () => { live = false; };
    // toast.show is stable enough; re-run only when the dialog opens or the recipe/servings change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, recipe.id, servings]);

  async function confirm() {
    setBusy(true);
    try {
      const log = await api.post(`/api/recipes/${recipe.id}/cook`, {
        servings, cooked_on: cookedOn, notes,
        deductions: lines.filter(l => l.use && Number(l.take) > 0).map(l => ({ batch_id: l.batch_id, take: Number(l.take) })),
      });
      toast.show({
        message: `Logged ${recipe.title}. Shelves updated.`,
        duration: 8000,
        action: {
          label: 'Undo',
          onClick: async () => {
            try {
              await api.del(`/api/cook-log/${log.id}`);
              onChanged?.();
              toast.show({ message: 'Put everything back on the shelves' });
            } catch (err) { toast.show({ message: err.message, duration: 6000 }); }
          },
        },
      });
      onDone();
    } catch (err) {
      toast.show({ message: err.message });
    } finally {
      setBusy(false);
    }
  }

  const setLine = (i, patch) => setLines(ls => ls.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  return (
    <Dialog open={open} onClose={onClose} title={`I cooked ${recipe.title}`} wide
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={confirm} disabled={busy || !plan}>Take from the shelves</Button></>}>
      <p className="hand">Here's what I'll take, soonest use-by first. Change anything that's off.</p>
      {!plan ? <p aria-busy="true">Checking the shelves…</p> : lines.length === 0 ? (
        <p className="muted">Nothing on your shelves matches this recipe, so there's nothing to take. I'll still log that you cooked it.</p>
      ) : (
        <div className="table-wrap">
          <table className="batch-table cook-table">
            <thead><tr><th>Use</th><th>Ingredient</th><th>From</th><th>Take</th><th>On hand</th></tr></thead>
            <tbody>
              {lines.map((l, i) => (
                <tr key={`${l.batch_id}-${i}`} className={l.use ? '' : 'is-used'}>
                  <td><input type="checkbox" aria-label={`Use ${l.item_name}`} checked={l.use} onChange={e => setLine(i, { use: e.target.checked })} /></td>
                  <td>{l.ingredient_name}</td>
                  <td>{l.item_name}</td>
                  <td className="take-cell"><input className="input input-sm" type="number" min="0" step="any" aria-label={`Amount of ${l.item_name}`} value={l.take}
                    onChange={e => setLine(i, { take: e.target.value })} /> <span>{l.unit}</span></td>
                  <td>{formatQty(l.available)} {l.unit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {plan?.unmatched.length > 0 && <p className="muted cook-unmatched">Not on your shelves: {plan.unmatched.join(', ')}.</p>}
      <div className="form-grid cook-fields">
        <Field label="Cooked on"><DateInput value={cookedOn} onChange={e => setCookedOn(e.target.value)} /></Field>
        <Field label="Notes" className="span-2"><TextArea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Added extra thyme…" /></Field>
      </div>
    </Dialog>
  );
}
