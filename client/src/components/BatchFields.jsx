import { Field, TextInput, NumberInput, DateInput, Select, TextArea } from './Field.jsx';
import { UNITS, SOURCES, METHODS, SOURCE_LABELS } from '../lib/options.js';

export const BOUGHT_KEYS = ['price', 'vendor', 'purchased_on'];
export const BATCH_KEYS = ['quantity', 'date_stored', 'use_by', 'source', 'method', 'container', 'container_count', 'batch_code'];

// Bought-only details are dropped when the batch didn't come from a shop.
export function batchPayload(form) {
  const bought = form.source === 'bought';
  return { ...form, price: bought ? form.price : null, vendor: bought ? form.vendor : null, purchased_on: bought ? form.purchased_on : null };
}

// Server messages whose key has no field on screen, so they still reach the user.
export function FormAlert({ errors, shown }) {
  const rest = Object.entries(errors ?? {}).filter(([k]) => !shown.includes(k)).map(([, v]) => v);
  if (!rest.length) return null;
  return (
    <div className="form-alert span-2" role="alert">
      <strong>Please check this:</strong>
      <ul>{rest.map((m, i) => <li key={i}>{m}</li>)}</ul>
    </div>
  );
}

export function shownBatchKeys(form, extra = []) {
  return [...BATCH_KEYS, ...extra, ...(form.source === 'bought' ? BOUGHT_KEYS : [])];
}

export function BatchFields({ form, setField, errors = {}, recipes, showUnit = false, showNotes = false }) {
  const on = k => e => setField(k, e.target.value);
  const units = !form.unit || UNITS.includes(form.unit) ? UNITS : [...UNITS, form.unit];
  const source = (
    <Field label="Where it came from" error={errors.source}>
      <Select value={form.source} onChange={on('source')} placeholder="Choose…" options={SOURCES.map(s => ({ value: s, label: SOURCE_LABELS[s] }))} />
    </Field>
  );
  return (
    <>
      <Field label="Quantity" error={errors.quantity}><NumberInput value={form.quantity} onChange={on('quantity')} min="0" /></Field>
      {showUnit
        ? <Field label="Unit" error={errors.unit}><Select value={form.unit} onChange={on('unit')} options={units.map(u => ({ value: u, label: u }))} /></Field>
        : source}
      <Field label="Date stored" error={errors.date_stored}><DateInput value={form.date_stored} onChange={on('date_stored')} /></Field>
      <Field label="Use by" error={errors.use_by}><DateInput value={form.use_by} onChange={on('use_by')} /></Field>
      {showUnit && source}
      <Field label="Method" error={errors.method}><Select value={form.method} onChange={on('method')} placeholder="Choose…" options={METHODS.map(m => ({ value: m, label: m }))} /></Field>
      <Field label="Container" error={errors.container}><TextInput value={form.container} onChange={on('container')} placeholder="pint jar" /></Field>
      <Field label="How many containers" error={errors.container_count}><NumberInput value={form.container_count} onChange={on('container_count')} min="0" step="1" /></Field>
      <Field label="Batch code" error={errors.batch_code}><TextInput value={form.batch_code} onChange={on('batch_code')} /></Field>
      {recipes && <Field label="Recipe used" error={errors.recipe_id}><Select value={form.recipe_id} onChange={on('recipe_id')} placeholder="None" options={recipes.map(r => ({ value: r.id, label: r.title }))} /></Field>}
      {form.source === 'bought' && (
        <>
          <Field label="Price paid" error={errors.price}><NumberInput value={form.price} onChange={on('price')} min="0" /></Field>
          <Field label="Where bought" error={errors.vendor}><TextInput value={form.vendor} onChange={on('vendor')} /></Field>
          <Field label="Bought on" error={errors.purchased_on}><DateInput value={form.purchased_on} onChange={on('purchased_on')} /></Field>
        </>
      )}
      {showNotes && <Field label="Notes" className="span-2" error={errors.notes}><TextArea value={form.notes} onChange={on('notes')} /></Field>}
    </>
  );
}
