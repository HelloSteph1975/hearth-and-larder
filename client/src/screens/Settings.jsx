import { useEffect, useRef, useState } from 'react';
import { ArrowUp, ArrowDown, Trash2, Plus, FolderOpen, DatabaseBackup, RotateCcw } from 'lucide-react';
import { PageHeader } from '../components/PageHeader.jsx';
import { Card } from '../components/Card.jsx';
import { Button } from '../components/Button.jsx';
import { Field, TextInput, NumberInput, Select } from '../components/Field.jsx';
import { FormAlert } from '../components/BatchFields.jsx';
import { StoreIcon, STORE_ICONS } from '../components/StoreIcon.jsx';
import { useStores } from '../components/StoresProvider.jsx';
import { useToast } from '../components/ToastProvider.jsx';
import { useConfirm } from '../components/ConfirmProvider.jsx';
import { useDeleteWithUndo } from '../components/useDeleteWithUndo.jsx';
import { useSettings } from '../components/SettingsProvider.jsx';
import { useApi } from '../lib/useApi.js';
import { api } from '../lib/api.js';

export function formatSize(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

const WEEK_OPTIONS = [
  { value: 'monday', label: 'Monday' },
  { value: 'sunday', label: 'Sunday' },
  { value: 'saturday', label: 'Saturday' },
];

function LoadError({ error, onRetry }) {
  return (
    <div className="error-card">
      <p className="error-note">{error.message}</p>
      <Button variant="secondary" size="sm" onClick={onRetry}>Try again</Button>
    </div>
  );
}

function ColorSwatch({ value, label, onCommit }) {
  const [color, setColor] = useState(value);
  const ref = useRef(null);
  const latest = useRef({ color, value, onCommit });
  latest.current = { color, value, onCommit };
  useEffect(() => setColor(value), [value]);
  useEffect(() => {
    const el = ref.current;
    // The native change event fires when the picker closes, not on every drag.
    const done = e => { const { value: v, onCommit: c } = latest.current; if (e.target.value !== v) c(e.target.value); };
    el.addEventListener('change', done);
    return () => el.removeEventListener('change', done);
  }, []);
  return <input ref={ref} type="color" className="color-swatch" aria-label={label} value={color} onChange={e => setColor(e.target.value)} />;
}

function SectionCard({ id, title, note, children }) {
  return (
    <Card as="section" className="settings-card" aria-labelledby={id}>
      <h2 id={id}>{title}</h2>
      {note && <p className="muted settings-note">{note}</p>}
      {children}
    </Card>
  );
}

// A name that saves itself when you leave the box or press Enter.
function EditableName({ value, label, onSave }) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  async function commit() {
    const next = text.trim();
    if (!next || next === value) { setText(value); return; }
    const ok = await onSave(next);
    if (!ok) setText(value);
  }
  return (
    <input className="input name-input" aria-label={label} value={text} maxLength={80}
      onChange={e => setText(e.target.value)} onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); } if (e.key === 'Escape') setText(value); }} />
  );
}

function AddRow({ label, placeholder, onAdd, error }) {
  const [name, setName] = useState('');
  async function submit(e) {
    e.preventDefault();
    if (!name.trim()) return;
    if (await onAdd(name.trim())) setName('');
  }
  return (
    <form className="add-row" onSubmit={submit}>
      <Field label={label} error={error} className="add-row-field">
        <TextInput value={name} placeholder={placeholder} maxLength={80} onChange={e => setName(e.target.value)} />
      </Field>
      <Button type="submit" variant="secondary" icon={Plus}>Add</Button>
    </form>
  );
}

function HouseholdCard() {
  const { data, error: loadError, reload } = useApi('/api/settings');
  const { reload: reloadShared } = useSettings();
  const toast = useToast();
  const [form, setForm] = useState(null);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (data) setForm({ ...data }); }, [data]);
  if (!form && loadError) return <SectionCard id="s-household" title="Household"><LoadError error={loadError} onRetry={reload} /></SectionCard>;
  if (!form) return <SectionCard id="s-household" title="Household"><span className="skeleton skeleton-card" aria-busy="true" /></SectionCard>;
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    try {
      await api.put('/api/settings', form);
      toast.show({ message: 'Saved' });
      reload();
      reloadShared();
    } catch (err) {
      setErrors(err.details && Object.keys(err.details).length ? err.details : { form: err.message });
    } finally { setSaving(false); }
  }

  return (
    <SectionCard id="s-household" title="Household" note="Your name appears in the greeting on the home screen.">
      <form onSubmit={save} className="settings-form" noValidate>
        <Field label="Household name" error={errors.household_name}>
          <TextInput value={form.household_name} maxLength={60} onChange={set('household_name')} />
        </Field>
        <Field label="Week starts on" error={errors.week_start}>
          <Select options={WEEK_OPTIONS} value={form.week_start} onChange={set('week_start')} />
        </Field>
        <Field label="Default servings" error={errors.default_servings}>
          <NumberInput min={1} max={50} step={1} value={form.default_servings} onChange={set('default_servings')} />
        </Field>
        <Field label="Warn me about use-by (days ahead)" error={errors.use_soon_days} hint="Batches inside this window show up under Use soon.">
          <NumberInput min={1} max={120} step={1} value={form.use_soon_days} onChange={set('use_soon_days')} />
        </Field>
        <FormAlert errors={errors} shown={['household_name', 'week_start', 'default_servings', 'use_soon_days']} />
        <div><Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button></div>
      </form>
    </SectionCard>
  );
}

function StoresCard() {
  const { stores, reload } = useStores();
  const toast = useToast();
  const del = useDeleteWithUndo();
  const [addError, setAddError] = useState();
  const [moving, setMoving] = useState(false);

  async function patch(store, body) {
    try { await api.patch(`/api/stores/${store.id}`, body); reload(); return true; } catch (err) {
      toast.show({ message: err.details?.name ?? err.message, duration: 6000 });
      return false;
    }
  }
  async function move(index, dir) {
    if (moving) return;
    setMoving(true);
    const order = stores.slice();
    const [row] = order.splice(index, 1);
    order.splice(index + dir, 0, row);
    try {
      await Promise.all(order.map((s, i) => (s.sort_order === i ? null : api.patch(`/api/stores/${s.id}`, { sort_order: i }))));
    } catch (err) { toast.show({ message: err.message, duration: 6000 }); }
    reload();
    setMoving(false);
  }
  async function add(name) {
    setAddError();
    try {
      await api.post('/api/stores', { name, icon: 'jar', color: '#6B8F4E', sort_order: stores.length });
      reload();
      return true;
    } catch (err) { setAddError(err.details?.name ?? err.message); return false; }
  }

  return (
    <SectionCard id="s-stores" title="Stores" note="The places you keep food. Each one gets its own page in the sidebar.">
      <ul className="edit-list">
        {stores.map((s, i) => (
          <li key={s.id} className="edit-row store-row">
            <StoreIcon icon={s.icon} size={26} />
            <EditableName value={s.name} label={`Name of ${s.name}`} onSave={name => patch(s, { name })} />
            <select className="input icon-select" aria-label={`Icon for ${s.name}`} value={s.icon} onChange={e => patch(s, { icon: e.target.value })}>
              {STORE_ICONS.map(ic => <option key={ic} value={ic}>{ic}</option>)}
            </select>
            <ColorSwatch label={`Color for ${s.name}`} value={s.color || '#6B8F4E'} onCommit={color => patch(s, { color })} />
            <div className="row-tools">
              <Button variant="ghost" size="sm" icon={ArrowUp} aria-label={`Move ${s.name} up`} disabled={moving || i === 0} onClick={() => move(i, -1)} />
              <Button variant="ghost" size="sm" icon={ArrowDown} aria-label={`Move ${s.name} down`} disabled={moving || i === stores.length - 1} onClick={() => move(i, 1)} />
              <Button variant="ghost" size="sm" icon={Trash2} aria-label={`Delete ${s.name}`} onClick={() => del({ url: `/api/stores/${s.id}`, label: s.name, onChange: reload })} />
            </div>
          </li>
        ))}
      </ul>
      <AddRow label="Add a store" placeholder="Root cellar" onAdd={add} error={addError} />
    </SectionCard>
  );
}

function LocationsCard() {
  const { stores } = useStores();
  const toast = useToast();
  const del = useDeleteWithUndo();
  const [pick, setPick] = useState('');
  const storeId = stores.some(s => String(s.id) === pick) ? pick : (stores[0] ? String(stores[0].id) : '');
  const { data: rows, error: loadError, reload } = useApi(storeId ? `/api/locations?store_id=${storeId}` : null);
  const [addError, setAddError] = useState();

  async function rename(row, name) {
    try { await api.patch(`/api/locations/${row.id}`, { name }); reload(); return true; } catch (err) {
      toast.show({ message: err.details?.name ?? err.message, duration: 6000 });
      return false;
    }
  }
  async function add(name) {
    setAddError();
    try { await api.post('/api/locations', { store_id: Number(storeId), name }); reload(); return true; } catch (err) {
      setAddError(err.details?.name ?? err.message);
      return false;
    }
  }

  return (
    <SectionCard id="s-locations" title="Shelves, bins and crocks" note="Pick a store, then name the spots inside it.">
      {stores.length === 0 ? <p className="hand">Add a store first.</p> : (
        <>
          <Field label="Store">
            <Select value={storeId} onChange={e => setPick(e.target.value)} options={stores.map(s => ({ value: String(s.id), label: s.name }))} />
          </Field>
          {loadError && <LoadError error={loadError} onRetry={reload} />}
          {rows && rows.length === 0 && <p className="hand">No spots yet. Add the first one below.</p>}
          <ul className="edit-list">
            {rows?.map(r => (
              <li key={r.id} className="edit-row">
                <EditableName value={r.name} label={`Name of ${r.name}`} onSave={name => rename(r, name)} />
                <div className="row-tools">
                  <Button variant="ghost" size="sm" icon={Trash2} aria-label={`Delete ${r.name}`} onClick={() => del({ url: `/api/locations/${r.id}`, label: r.name, onChange: reload })} />
                </div>
              </li>
            ))}
          </ul>
          <AddRow label="Add a shelf, bin or crock" placeholder="Top shelf" onAdd={add} error={addError} />
        </>
      )}
    </SectionCard>
  );
}

function CategoryList({ kind, title }) {
  const { data: rows, error: loadError, reload } = useApi(`/api/categories?kind=${kind}`);
  const toast = useToast();
  const del = useDeleteWithUndo();
  const [addError, setAddError] = useState();

  async function rename(row, name) {
    try { await api.patch(`/api/categories/${row.id}`, { name }); reload(); return true; } catch (err) {
      toast.show({ message: err.details?.name ?? err.message, duration: 6000 });
      return false;
    }
  }
  async function add(name) {
    setAddError();
    const next = rows?.length ? Math.max(...rows.map(r => r.sort_order ?? 0)) + 1 : 0;
    try { await api.post('/api/categories', { name, kind, sort_order: next }); reload(); return true; } catch (err) {
      setAddError(err.details?.name ?? err.message);
      return false;
    }
  }
  return (
    <div className="category-col">
      <h3>{title}</h3>
      {loadError && <LoadError error={loadError} onRetry={reload} />}
      <ul className="edit-list">
        {rows?.map(r => (
          <li key={r.id} className="edit-row">
            <EditableName value={r.name} label={`Name of ${title.toLowerCase()} ${r.name}`} onSave={name => rename(r, name)} />
            <div className="row-tools">
              <Button variant="ghost" size="sm" icon={Trash2} aria-label={`Delete ${r.name}`} onClick={() => del({ url: `/api/categories/${r.id}`, label: r.name, onChange: reload })} />
            </div>
          </li>
        ))}
      </ul>
      <AddRow label={`Add to ${title.toLowerCase()}`} placeholder="New category" onAdd={add} error={addError} />
    </div>
  );
}

function CategoriesCard() {
  return (
    <SectionCard id="s-categories" title="Categories" note="Used to sort what is on your shelves and what is on your shopping list.">
      <div className="category-grid">
        <CategoryList kind="item" title="Shelf categories" />
        <CategoryList kind="shopping" title="Shopping categories" />
      </div>
    </SectionCard>
  );
}

function DataCard() {
  const { data, error: loadError, reload } = useApi('/api/data-folder');
  const toast = useToast();
  async function open() {
    try { await api.post('/api/data-folder/open'); } catch (err) { toast.show({ message: err.message, duration: 6000 }); }
  }
  return (
    <SectionCard id="s-data" title="Your data">
      <p className="muted">Your database, photos and nightly backups live here.</p>
      {loadError ? <LoadError error={loadError} onRetry={reload} /> : <p className="data-path" aria-label="Data folder">{data?.path ?? '...'}</p>}
      <Button variant="secondary" icon={FolderOpen} onClick={open}>Open folder</Button>
    </SectionCard>
  );
}

export function BackupsCard() {
  const { data: backups, error, reload } = useApi('/api/backups');
  const toast = useToast();
  const confirm = useConfirm();
  const [busy, setBusy] = useState(false);
  const [restoring, setRestoring] = useState(false);

  async function backUp() {
    setBusy(true);
    try { await api.post('/api/backups'); toast.show({ message: 'Backed up. Your jars are safe.' }); reload(); } catch (err) {
      toast.show({ message: err.message, duration: 6000 });
    } finally { setBusy(false); }
  }
  async function restore(b) {
    const when = new Date(b.modified).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
    const ok = await confirm({
      title: `Restore the ${when} backup?`,
      body: 'Your current data is saved as a safety copy first.',
      confirmLabel: 'Restore',
    });
    if (!ok) return;
    setRestoring(true);
    try {
      await api.post('/api/backups/restore', { name: b.name });
      toast.show({ message: 'Restored. Reloading...' });
      setTimeout(() => window.location.reload(), 900);
    } catch (err) { toast.show({ message: err.message, duration: 8000 }); setRestoring(false); }
  }

  return (
    <SectionCard id="s-backups" title="Backups" note="A backup is made every night and when the app shuts down.">
      <div><Button icon={DatabaseBackup} onClick={backUp} disabled={busy || restoring}>{busy ? 'Backing up...' : 'Back up now'}</Button></div>
      {error && <p className="error-note">{error.message}</p>}
      {backups && backups.length === 0 && <p className="hand">No backups yet.</p>}
      {backups && backups.length > 0 && (
        <div className="table-wrap backups-table">
          <table className="batch-table">
            <thead><tr><th scope="col">Name</th><th scope="col">Date</th><th scope="col">Size</th><th scope="col"><span className="visually-hidden">Actions</span></th></tr></thead>
            <tbody>
              {backups.map(b => (
                <tr key={b.name}>
                  <td>{b.name.startsWith('pre-restore-') ? 'Safety copy before restore' : b.name}</td>
                  <td>{new Date(b.modified).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</td>
                  <td>{formatSize(b.size)}</td>
                  <td className="row-actions"><Button variant="secondary" size="sm" icon={RotateCcw} aria-label={`Restore ${b.name}`} disabled={restoring} onClick={() => restore(b)}>Restore</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  );
}

export function Settings() {
  return (
    <>
      <PageHeader title="Settings" note="make the kitchen yours" />
      <div className="settings-stack">
        <HouseholdCard />
        <StoresCard />
        <LocationsCard />
        <CategoriesCard />
        <DataCard />
        <BackupsCard />
      </div>
    </>
  );
}
