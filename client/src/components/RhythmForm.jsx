import { useEffect, useState } from 'react';
import { Dialog } from './Dialog.jsx';
import { Button } from './Button.jsx';
import { FormAlert } from './BatchFields.jsx';
import { Field, TextInput, NumberInput, DateInput, TextArea, Select } from './Field.jsx';
import { useToast } from './ToastProvider.jsx';
import { api } from '../lib/api.js';
import { PRESETS, MONTHS, presetOf } from '../lib/rhythm.js';

const blank = { name: '', preset: 'w1', every_min: '', every_max: '', every_unit: 'weeks', months: [], crops: '', notes: '' };
const fromRow = r => ({
  name: r.name, preset: presetOf(r), every_min: r.every_min ?? '', every_max: r.every_max ?? '', every_unit: r.every_unit ?? 'weeks',
  months: (r.season_months ?? '').split(',').filter(Boolean).map(Number), crops: r.crops ?? '', notes: r.notes ?? '',
});

// Turns the form into what the server stores: a repeat or a set of months, never both.
export function rhythmBody(form) {
  const base = { name: form.name, crops: form.crops || null, notes: form.notes || null };
  if (form.preset === 'season') {
    const months = [...form.months].sort((a, b) => a - b);
    return { ...base, every_min: null, every_max: null, every_unit: null, season_months: months.length ? months.join(',') : null };
  }
  const preset = PRESETS.find(p => p.value === form.preset);
  const [min, max, unit] = preset?.every ?? [form.every_min === '' ? null : Number(form.every_min), form.every_max === '' ? null : Number(form.every_max), form.every_unit];
  return { ...base, every_min: min, every_max: max ?? min, every_unit: unit, season_months: null };
}

// Adds a staple, or edits one with `rhythm`.
export function RhythmForm({ open, rhythm, onClose, onSaved }) {
  const [form, setForm] = useState(blank);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setForm(rhythm ? fromRow(rhythm) : blank);
  }, [open, rhythm]);

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));
  const toggleMonth = m => setForm(f => ({ ...f, months: f.months.includes(m) ? f.months.filter(x => x !== m) : [...f.months, m] }));

  async function save() {
    if (busy) return;
    setBusy(true);
    setErrors({});
    try {
      const body = rhythmBody(form);
      if (rhythm) await api.patch(`/api/rhythms/${rhythm.id}`, body);
      else await api.post('/api/rhythms', body);
      toast.show({ message: rhythm ? `Saved ${form.name}` : `Added ${form.name} to your rhythm` });
      onSaved();
    } catch (err) { setErrors(err.details ?? {}); toast.show({ message: err.message }); } finally { setBusy(false); }
  }

  return (
    <Dialog open={open} onClose={onClose} title={rhythm ? `Edit ${rhythm.name}` : 'Add a staple'}
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={save} disabled={busy}>Save</Button></>}>
      <div className="form-grid">
        <Field label="What you make" className="span-2" error={errors.name}><TextInput value={form.name} onChange={set('name')} placeholder="Sourdough, ghee, pesto…" /></Field>
        <Field label="How often" className="span-2" error={errors.every_min}>
          <Select value={form.preset} onChange={set('preset')} options={PRESETS.map(p => ({ value: p.value, label: p.label }))} />
        </Field>
        {form.preset === 'own' && (
          <>
            <Field label="Every" error={errors.every_min}><NumberInput value={form.every_min} onChange={set('every_min')} min="1" /></Field>
            <Field label="Up to" hint="Leave empty for exactly" error={errors.every_max}><NumberInput value={form.every_max} onChange={set('every_max')} min="1" /></Field>
            <Field label="Weeks, months or years" className="span-2" error={errors.every_unit}>
              <Select value={form.every_unit} onChange={set('every_unit')} options={[{ value: 'weeks', label: 'Weeks' }, { value: 'months', label: 'Months' }, { value: 'years', label: 'Years' }]} />
            </Field>
          </>
        )}
        {form.preset === 'season' && (
          <fieldset className="span-2 batch-pick">
            <legend>Its months</legend>
            <div className="batch-pick-days">
              {MONTHS.map((m, i) => (
                <label key={m} className={`batch-pick-day${form.months.includes(i + 1) ? ' is-on' : ''}`}>
                  <input type="checkbox" checked={form.months.includes(i + 1)} onChange={() => toggleMonth(i + 1)} /> {m}
                </label>
              ))}
            </div>
            {errors.season_months && <small className="field-error" role="alert">{errors.season_months}</small>}
          </fieldset>
        )}
        <Field label="Made from" className="span-2" hint="Crops, with a comma between each. A harvest of one makes this due." error={errors.crops}>
          <TextInput value={form.crops} onChange={set('crops')} placeholder="Tomatoes, Basil" />
        </Field>
        <Field label="Notes" className="span-2"><TextArea value={form.notes} onChange={set('notes')} /></Field>
        <FormAlert errors={errors} shown={['name', 'every_min', 'every_max', 'every_unit', 'season_months', 'crops']} />
      </div>
    </Dialog>
  );
}

// Logs a harvest by hand. A garden app can post to the same place.
export function HarvestDialog({ open, today, onClose, onSaved }) {
  const empty = { crop: '', quantity: '', unit: '', harvested_on: today, note: '' };
  const [form, setForm] = useState(empty);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  useEffect(() => { if (open) { setForm({ ...empty, harvested_on: today }); setErrors({}); } }, [open, today]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));
  async function save() {
    if (busy) return;
    setBusy(true);
    try {
      await api.post('/api/harvests', { ...form, quantity: form.quantity === '' ? null : Number(form.quantity), source: 'manual' });
      toast.show({ message: `Logged the ${form.crop.toLowerCase()}` });
      onSaved();
    } catch (err) { setErrors(err.details ?? {}); toast.show({ message: err.message }); } finally { setBusy(false); }
  }
  return (
    <Dialog open={open} onClose={onClose} title="Log a harvest"
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={save} disabled={busy}>Log it</Button></>}>
      <div className="form-grid">
        <Field label="Crop" className="span-2" error={errors.crop}><TextInput value={form.crop} onChange={set('crop')} placeholder="Tomatoes" /></Field>
        <Field label="Amount" error={errors.quantity}><NumberInput value={form.quantity} onChange={set('quantity')} min="0" /></Field>
        <Field label="Unit"><TextInput value={form.unit} onChange={set('unit')} placeholder="lb" /></Field>
        <Field label="Picked on" className="span-2" error={errors.harvested_on}><DateInput value={form.harvested_on} onChange={set('harvested_on')} /></Field>
        <Field label="Note" className="span-2"><TextInput value={form.note} onChange={set('note')} /></Field>
      </div>
    </Dialog>
  );
}
