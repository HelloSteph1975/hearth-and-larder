import { useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Check, Pencil, Plus, Trash2, X, PackageCheck, ListChecks } from 'lucide-react';
import { useApi } from '../lib/useApi.js';
import { api } from '../lib/api.js';
import { todayISO, weekStart, addDays } from '../lib/dates.js';
import { formatMoney, formatQty } from '../lib/format.js';
import { PageHeader } from '../components/PageHeader.jsx';
import { Button } from '../components/Button.jsx';
import { PrintButton, PrintHeader } from '../components/Print.jsx';
import { Badge } from '../components/Badge.jsx';
import { Dialog } from '../components/Dialog.jsx';
import { EmptyState } from '../components/EmptyState.jsx';
import { FormAlert } from '../components/BatchFields.jsx';
import { Field, TextInput, NumberInput, DateInput, Select } from '../components/Field.jsx';
import { useStores } from '../components/StoresProvider.jsx';
import { useToast } from '../components/ToastProvider.jsx';
import { useDeleteWithUndo } from '../components/useDeleteWithUndo.jsx';

// Aisles follow the category order from Settings (category_sort), with Other last.
export function groupShopping(rows) {
  const map = new Map();
  for (const r of rows) {
    const c = r.category_name ?? 'Other';
    if (!map.has(c)) map.set(c, { category: c, sort: Infinity, items: [] });
    const g = map.get(c);
    if (r.category_sort != null) g.sort = Math.min(g.sort, r.category_sort);
    g.items.push(r);
  }
  return [...map.values()]
    .sort((a, b) => (a.category === 'Other') - (b.category === 'Other') || (a.sort - b.sort) || a.category.localeCompare(b.category))
    .map(({ category, items }) => ({ category, items }));
}
export const estimatedTotal = rows => Math.round(rows.filter(r => !r.checked && r.est_price != null).reduce((s, r) => s + r.est_price, 0) * 100) / 100;

const SHOWN = ['name', 'quantity', 'unit', 'category_id', 'est_price'];
const toBody = f => ({
  name: f.name.trim(),
  quantity: f.quantity === '' ? null : Number(f.quantity),
  unit: f.unit.trim() || null,
  category_id: f.category_id ? Number(f.category_id) : null,
  est_price: f.est_price === '' ? null : Number(f.est_price),
});
const blank = { name: '', quantity: '', unit: '', category_id: '', est_price: '' };
const catOptions = cats => (cats ?? []).map(c => ({ value: c.id, label: c.name }));

function QuickAdd({ categories, onAdded }) {
  const [form, setForm] = useState(blank);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const nameRef = useRef();
  const toast = useToast();
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));
  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    if (!form.name.trim()) { setErrors({ name: 'What do you need?' }); nameRef.current?.focus(); return; }
    setBusy(true);
    setErrors({});
    try {
      await api.post('/api/shopping', toBody(form));
      setForm(f => ({ ...blank, category_id: f.category_id }));
      onAdded();
    } catch (err) {
      setErrors(err.details ?? {});
      if (!Object.keys(err.details ?? {}).length) toast.show({ message: err.message, duration: 6000 });
    } finally { setBusy(false); nameRef.current?.focus(); }
  }
  return (
    <form className="quick-add card card-butter no-print" onSubmit={submit} aria-label="Add to the list" noValidate>
      <Field label="Add something" error={errors.name} className="qa-name"><TextInput ref={nameRef} value={form.name} onChange={set('name')} placeholder="Butter, lamp oil, thread" autoComplete="off" /></Field>
      <Field label="Amount" error={errors.quantity} className="qa-qty"><NumberInput value={form.quantity} onChange={set('quantity')} min="0" /></Field>
      <Field label="Unit" error={errors.unit} className="qa-unit"><TextInput value={form.unit} onChange={set('unit')} list="shopping-units" placeholder="lb" /></Field>
      <Field label="Aisle" error={errors.category_id} className="qa-cat"><Select value={form.category_id} onChange={set('category_id')} placeholder="Other" options={catOptions(categories)} /></Field>
      <Field label="Price" error={errors.est_price} className="qa-price"><NumberInput value={form.est_price} onChange={set('est_price')} min="0" placeholder="$" /></Field>
      <Button type="submit" icon={Plus} disabled={busy} className="qa-go">Add</Button>
      <div className="qa-alert"><FormAlert errors={errors} shown={SHOWN} /></div>
    </form>
  );
}

function Row({ item, categories, onChange, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(blank);
  const [errors, setErrors] = useState({});
  const toast = useToast();
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));
  const start = () => {
    setErrors({});
    setForm({ name: item.name, quantity: item.quantity ?? '', unit: item.unit ?? '', category_id: item.category_id ?? '', est_price: item.est_price ?? '' });
    setEditing(true);
  };
  const ticking = useRef(false);
  async function toggle() {
    if (ticking.current) return;
    ticking.current = true;
    try { await api.patch(`/api/shopping/${item.id}`, { checked: !item.checked }); onChange(); } catch (err) { toast.show({ message: err.message, duration: 6000 }); } finally { ticking.current = false; }
  }
  async function save(e) {
    e.preventDefault();
    if (!form.name.trim()) { setErrors({ name: 'Give it a name' }); return; }
    try { await api.patch(`/api/shopping/${item.id}`, toBody(form)); setEditing(false); onChange(); } catch (err) { setErrors(err.details ?? { name: err.message }); }
  }
  if (editing) {
    return (
      <li className="note-row is-editing">
        <form onSubmit={save} className="note-edit" aria-label={`Edit ${item.name}`} noValidate>
          <TextInput aria-label="Name" aria-invalid={Boolean(errors.name)} value={form.name} onChange={set('name')} autoFocus />
          <NumberInput aria-label="Amount" value={form.quantity} onChange={set('quantity')} min="0" />
          <TextInput aria-label="Unit" value={form.unit} onChange={set('unit')} list="shopping-units" />
          <Select aria-label="Aisle" value={form.category_id} onChange={set('category_id')} placeholder="Other" options={catOptions(categories)} />
          <NumberInput aria-label="Price" value={form.est_price} onChange={set('est_price')} min="0" />
          <span className="note-actions">
            <Button type="submit" size="sm" icon={Check}>Save</Button>
            <Button size="sm" variant="ghost" icon={X} onClick={() => setEditing(false)}>Cancel</Button>
          </span>
          {Object.values(errors).length > 0 && <small className="field-error" role="alert">{Object.values(errors).join(' ')}</small>}
        </form>
      </li>
    );
  }
  const qty = [item.quantity != null ? formatQty(item.quantity) : '', item.unit].filter(Boolean).join(' ');
  return (
    <li className={`note-row ${item.checked ? 'is-ticked' : ''}`}>
      <label className="checkbox note-check">
        <input type="checkbox" checked={Boolean(item.checked)} onChange={toggle} aria-label={`Got ${item.name}`} />
      </label>
      <span className="note-name hand">{item.name}</span>
      {item.origin === 'plan' && <Badge tone="garden">from plan</Badge>}
      <span className="note-qty">{qty}</span>
      <span className="note-price">{item.est_price != null ? formatMoney(item.est_price) : ''}</span>
      <span className="note-actions no-print">
        <button className="icon-btn" aria-label={`Edit ${item.name}`} onClick={start}><Pencil size={16} /></button>
        <button className="icon-btn" aria-label={`Delete ${item.name}`} onClick={() => onDelete(item)}><Trash2 size={16} /></button>
      </span>
    </li>
  );
}

export function Shopping() {
  const [params] = useSearchParams();
  const { data: settings } = useApi('/api/settings');
  const { data: rows, loading, error, reload } = useApi('/api/shopping');
  const { data: categories } = useApi('/api/categories?kind=shopping');
  const { stores } = useStores();
  const toast = useToast();
  const del = useDeleteWithUndo();

  const defaultFrom = params.get('from') ?? weekStart(todayISO(), settings?.week_start ?? 'monday');
  const defaultTo = params.get('to') ?? addDays(defaultFrom, 6);
  const [range, setRange] = useState({ from: null, to: null });
  const from = range.from ?? defaultFrom;
  const to = range.to ?? defaultTo;
  const [building, setBuilding] = useState(false);
  const [putting, setPutting] = useState(false);
  const [storeId, setStoreId] = useState('');
  const [busy, setBusy] = useState(false);

  const all = rows ?? [];
  const todo = all.filter(r => !r.checked);
  const basket = all.filter(r => r.checked);
  const total = estimatedTotal(all);

  async function build() {
    if (from > to) { toast.show({ message: 'The end date comes before the start date.', duration: 6000 }); return; }
    setBuilding(true);
    try {
      const list = await api.post('/api/shopping/build', { from, to });
      const n = list.filter(r => r.origin === 'plan' && !r.checked).length;
      toast.show({ message: n ? `Added ${n} thing${n === 1 ? '' : 's'} from the plan` : 'Nothing to buy: the larder already covers this plan' });
      reload();
    } catch (err) { toast.show({ message: err.message, duration: 6000 }); } finally { setBuilding(false); }
  }

  function undoWith(stamp, brought) {
    return async () => {
      try { await api.post('/api/shopping/restore-many', { stamp }); reload(); toast.show({ message: brought }); } catch (err) { toast.show({ message: err.message, duration: 6000 }); }
    };
  }

  async function putAway() {
    const sid = Number(storeId || stores[0]?.id);
    if (!sid || busy) return;
    const store = stores.find(s => s.id === sid);
    setBusy(true);
    try {
      const res = await api.post('/api/shopping/put-away', { ids: basket.map(r => r.id), store_id: sid, today: todayISO() });
      setPutting(false);
      reload();
      const n = res.batches.length;
      toast.show({
        message: `Put away ${n} thing${n === 1 ? '' : 's'} in ${store?.name ?? 'the store'}. Undo puts them back on the list; the new batches stay and can be removed on the item page.`,
        duration: 12000,
        action: { label: 'Undo', onClick: undoWith(res.stamp, 'Back on the list') },
      });
    } catch (err) { toast.show({ message: err.message, duration: 6000 }); } finally { setBusy(false); }
  }

  async function clearTicked() {
    try {
      const res = await api.post('/api/shopping/clear-checked');
      reload();
      toast.show({
        message: `Cleared ${res.ids.length} ticked thing${res.ids.length === 1 ? '' : 's'}`,
        duration: 8000,
        action: { label: 'Undo', onClick: undoWith(res.stamp, 'Brought them back') },
      });
    } catch (err) { toast.show({ message: err.message, duration: 6000 }); }
  }

  const removeRow = item => del({ url: `/api/shopping/${item.id}`, label: item.name, onChange: reload, body: 'It comes off the list. You can undo this for a few seconds.' });
  const buildButton = <Button onClick={build} disabled={building} icon={ListChecks}>Build from the plan</Button>;
  const empty = rows && !all.length;
  const note = todo.length && total ? `about ${formatMoney(total)} for what's left` : todo.length ? `${todo.length} thing${todo.length === 1 ? '' : 's'} to get` : null;

  return (
    <div className="shopping">
      <PrintHeader what="Shopping list" className="print-only" />
      <PageHeader title="Shopping List" note={note}
        actions={all.length > 0 && <PrintButton />} />
      <div className="build-bar card card-butter no-print">
        <Field label="From"><DateInput value={from} onChange={e => setRange(r => ({ ...r, from: e.target.value }))} /></Field>
        <Field label="To"><DateInput value={to} onChange={e => setRange(r => ({ ...r, to: e.target.value }))} /></Field>
        {buildButton}
        <p className="hand build-hint">Anything the larder already holds is left off.</p>
      </div>
      <QuickAdd categories={categories} onAdded={reload} />
      <datalist id="shopping-units">{['each', 'lb', 'oz', 'kg', 'g', 'cup', 'tbsp', 'tsp', 'quart', 'pint', 'gallon', 'bunch', 'head', 'bag', 'can', 'bottle', 'jar'].map(u => <option key={u} value={u} />)}</datalist>

      {error && !rows && <div className="card error-card"><p className="error-note" role="alert">{error.message}</p><Button variant="secondary" onClick={reload}>Try again</Button></div>}
      {loading && !rows && <div className="skeleton skeleton-card" aria-busy="true" aria-label="Loading" />}
      {empty && <EmptyState art="basket" title="Nothing on the list" body="Plan a few meals, then let the list write itself, or add things above." action={buildButton} />}

      {todo.length > 0 && (
        <div className="notepads">
          {groupShopping(todo).map(g => (
            <section key={g.category} className="notepad" aria-label={g.category}>
              <h2 className="notepad-title">{g.category}</h2>
              <ul className="note-list">{g.items.map(i => <Row key={i.id} item={i} categories={categories} onChange={reload} onDelete={removeRow} />)}</ul>
            </section>
          ))}
        </div>
      )}
      {all.length > 0 && !todo.length && <p className="hand all-done">Everything is in the basket.</p>}

      {basket.length > 0 && (
        <section className="notepad basket-pad" aria-label="In the basket">
          <div className="basket-head">
            <h2 className="notepad-title">In the basket <small className="muted">({basket.length})</small></h2>
            <div className="basket-actions no-print">
              <Button icon={PackageCheck} onClick={() => { setStoreId(String(stores[0]?.id ?? '')); setPutting(true); }} disabled={!stores.length}>Put away ticked</Button>
              <Button variant="ghost" icon={Trash2} onClick={clearTicked}>Clear ticked</Button>
            </div>
          </div>
          <ul className="note-list">{basket.map(i => <Row key={i.id} item={i} categories={categories} onChange={reload} onDelete={removeRow} />)}</ul>
        </section>
      )}

      <Dialog open={putting} onClose={() => setPutting(false)} title="Put away ticked things"
        footer={<><Button variant="ghost" onClick={() => setPutting(false)}>Cancel</Button><Button onClick={putAway} disabled={busy}>Put away {basket.length}</Button></>}>
        <p>These {basket.length} thing{basket.length === 1 ? '' : 's'} will be stocked as bought today, with the amounts and prices on the list.</p>
        <Field label="Which store?"><Select value={storeId} onChange={e => setStoreId(e.target.value)} options={stores.map(s => ({ value: s.id, label: s.name }))} /></Field>
      </Dialog>
    </div>
  );
}
