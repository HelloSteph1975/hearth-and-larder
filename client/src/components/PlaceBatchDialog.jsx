import { useEffect, useState } from 'react';
import { Dialog } from './Dialog.jsx';
import { Button } from './Button.jsx';
import { Field, DateInput } from './Field.jsx';
import { useToast } from './ToastProvider.jsx';
import { api } from '../lib/api.js';
import { prettyDate, weekDays } from '../lib/dates.js';
import { KIND_LABEL, DEFAULT_OFFSETS, datesFor } from '../lib/batch.js';

// Picks a week and three of its days, then puts the batch week's tasks on the planner.
export function PlaceBatchDialog({ open, plan, start, onClose, onSaved }) {
  const [from, setFrom] = useState(start);
  const [offsets, setOffsets] = useState(DEFAULT_OFFSETS);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const toast = useToast();

  useEffect(() => {
    if (!open) return;
    setFrom(start);
    setOffsets(DEFAULT_OFFSETS);
    setError(null);
  }, [open, start, plan?.id]);

  const days = from ? weekDays(from) : [];
  const dates = from && offsets.length === 3 ? datesFor(from, offsets) : [];
  const toggle = i => setOffsets(o => (o.includes(i) ? o.filter(x => x !== i) : o.length < 3 ? [...o, i] : o));

  async function save() {
    if (busy || dates.length !== 3) return;
    setBusy(true);
    setError(null);
    try {
      await api.post(`/api/batch-plans/${plan.id}/place`, { dates });
      toast.show({ message: `Week ${plan.week_no} is on the planner` });
      onSaved(from);
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  if (!plan) return null;
  return (
    <Dialog open={open} onClose={onClose} title={`Put Week ${plan.week_no} on the planner`}
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={save} disabled={busy || dates.length !== 3}>Put on the planner</Button></>}>
      <div className="form-grid">
        <Field label="Week starting" className="span-2"><DateInput value={from} onChange={e => e.target.value && setFrom(e.target.value)} /></Field>
        <fieldset className="span-2 batch-pick">
          <legend>Pick three days</legend>
          <div className="batch-pick-days">
            {days.map((d, i) => (
              <label key={d} className={`batch-pick-day${offsets.includes(i) ? ' is-on' : ''}`}>
                <input type="checkbox" checked={offsets.includes(i)} onChange={() => toggle(i)} disabled={!offsets.includes(i) && offsets.length >= 3} />
                {prettyDate(d)}
              </label>
            ))}
          </div>
          <small className="field-hint">{offsets.length} of 3 picked</small>
        </fieldset>
        {dates.length === 3 && (
          <ol className="span-2 batch-pick-preview" aria-label="What goes where">
            {plan.days.map((d, i) => <li key={d.id}><strong>{prettyDate(dates[i])}</strong>: Day {d.day_no}, {KIND_LABEL[d.kind].toLowerCase()}</li>)}
          </ol>
        )}
        {error && <p className="span-2 error-note" role="alert">{error}</p>}
      </div>
    </Dialog>
  );
}
