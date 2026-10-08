import { useEffect, useState } from 'react';
import { Dialog } from './Dialog.jsx';
import { Button } from './Button.jsx';
import { FormAlert } from './BatchFields.jsx';
import { Field, TextInput, NumberInput, DateInput, Select } from './Field.jsx';
import { useToast } from './ToastProvider.jsx';
import { api } from '../lib/api.js';
import { prettyDate, todayISO } from '../lib/dates.js';

export const SLOTS = ['breakfast', 'lunch', 'supper', 'snack'];
export const SLOT_LABEL = { breakfast: 'Breakfast', lunch: 'Lunch', supper: 'Supper', snack: 'Snack' };

// With `entry`, edits that plan entry (PATCH) instead of adding a new one.
export function AddToPlanDialog({ open, recipe, recipes, initial, entry, onClose, onSaved }) {
  const defaults = () => (entry
    ? { date: entry.date, slot: entry.slot, recipe_id: entry.recipe_id ?? '', servings: entry.servings ?? '', note: entry.note ?? '' }
    : { date: initial?.date ?? todayISO(), slot: initial?.slot ?? 'supper', recipe_id: recipe?.id ?? '', servings: recipe?.servings ?? '', note: '' });
  const [form, setForm] = useState(defaults);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setForm(defaults());
    // Reset only when the dialog opens or its target changes, not on every parent render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial?.date, initial?.slot, recipe?.id, entry?.id]);

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));
  async function save() {
    if (busy) return;
    setBusy(true);
    setErrors({});
    const body = { ...form, recipe_id: form.recipe_id ? Number(form.recipe_id) : null, note: form.recipe_id ? null : form.note };
    if (!body.recipe_id) body.servings = null;
    try {
      if (entry) await api.patch(`/api/plan/${entry.id}`, body);
      else await api.post('/api/plan', body);
      toast.show({ message: entry ? `Saved for ${prettyDate(form.date)}` : `Planned for ${prettyDate(form.date)}` });
      onSaved ? onSaved() : onClose();
    } catch (err) { setErrors(err.details ?? {}); toast.show({ message: err.message }); } finally { setBusy(false); }
  }
  return (
    <Dialog open={open} onClose={onClose} title={entry ? `Edit ${entry.recipe_title ?? 'plan note'}` : recipe ? `Plan ${recipe.title}` : 'Add to the plan'}
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={save} disabled={busy}>Save</Button></>}>
      <div className="form-grid">
        <Field label="Day" error={errors.date}><DateInput value={form.date} onChange={set('date')} /></Field>
        <Field label="Meal" error={errors.slot}><Select value={form.slot} onChange={set('slot')} options={SLOTS.map(s => ({ value: s, label: SLOT_LABEL[s] }))} /></Field>
        {!recipe && <Field label="Recipe" className="span-2"><Select value={form.recipe_id} onChange={set('recipe_id')} placeholder="None (write a note)" options={(recipes ?? []).map(r => ({ value: r.id, label: r.title }))} /></Field>}
        {!recipe && !form.recipe_id && <Field label="Note" className="span-2" error={errors.note}><TextInput value={form.note} onChange={set('note')} placeholder="Leftovers, eating out…" /></Field>}
        {(recipe || form.recipe_id) && <Field label="Servings" error={errors.servings}><NumberInput value={form.servings} onChange={set('servings')} min="0.25" /></Field>}
        <FormAlert errors={errors} shown={['date', 'slot', 'note', 'servings']} />
      </div>
    </Dialog>
  );
}
