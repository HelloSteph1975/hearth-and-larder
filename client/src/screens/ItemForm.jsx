import { useEffect, useState } from 'react';
import { Dialog } from '../components/Dialog.jsx';
import { Button } from '../components/Button.jsx';
import { Field, TextInput, NumberInput, DateInput, Select, TextArea, Checkbox } from '../components/Field.jsx';
import { useApi } from '../lib/useApi.js';
import { api } from '../lib/api.js';
import { todayISO } from '../lib/dates.js';
import { UNITS } from '../lib/options.js';
import { BatchFields, FormAlert, batchPayload, shownBatchKeys } from '../components/BatchFields.jsx';
import { uploadPhoto } from '../components/PhotoGallery.jsx';
import { useToast } from '../components/ToastProvider.jsx';
import { useStores } from '../components/StoresProvider.jsx';

const blankBatch = () => ({ quantity: '', date_stored: todayISO(), use_by: '', source: '', method: '', container: '', container_count: '', batch_code: '', price: '', vendor: '', purchased_on: '' });

const ITEM_KEYS = ['name', 'unit', 'category_id', 'location_id', 'low_threshold', 'notes'];

export function ItemForm({ open, onClose, onSaved, item, storeId }) {
  const editing = Boolean(item);
  const [form, setForm] = useState({});
  const [batch, setBatch] = useState(blankBatch());
  const [files, setFiles] = useState([]);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const toast = useToast();
  const { stores } = useStores();
  const sid = form.store_id ?? storeId;
  const { data: categories } = useApi(open ? '/api/categories?kind=item' : null);
  const { data: locations } = useApi(open && sid ? `/api/locations?store_id=${sid}` : null);

  useEffect(() => {
    if (!open) return;
    setForm(item ? { ...item } : { store_id: storeId, name: '', unit: 'each', category_id: '', location_id: '', low_threshold: '', notes: '', favorite: 0 });
    setBatch(blankBatch());
    setFiles([]);
    setErrors({});
  }, [open, item, storeId]);

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const setB = (k, v) => setBatch(b => ({ ...b, [k]: v }));
  // Moving to another store: its shelves are different, so the old one no longer applies.
  const setStore = e => setForm(f => ({ ...f, store_id: Number(e.target.value), location_id: '' }));

  async function save(e) {
    e.preventDefault();
    const filled = Object.entries(batch).some(([k, v]) => k !== 'date_stored' && v !== '');
    if (!editing && batch.quantity === '' && filled) {
      setErrors({ quantity: 'Add a quantity for the first batch' });
      return;
    }
    setSaving(true);
    setErrors({});
    const body = {
      store_id: Number(sid), name: form.name, unit: form.unit || 'each',
      category_id: form.category_id || null, location_id: form.location_id || null,
      low_threshold: form.low_threshold, notes: form.notes, favorite: Boolean(form.favorite),
    };
    if (!editing && batch.quantity !== '') body.first_batch = { ...batchPayload(batch), unit: form.unit || 'each' };
    try {
      const saved = editing ? await api.patch(`/api/items/${item.id}`, body) : await api.post('/api/items', body);
      let photoFailed = false;
      for (const f of files) {
        try { await uploadPhoto('item', saved.id, f); } catch { photoFailed = true; }
      }
      toast.show({ message: photoFailed ? `Saved ${form.name}, but a photo didn't upload` : editing ? `Saved ${form.name}` : `Added ${form.name}` });
      onSaved(saved);
    } catch (err) {
      setErrors(err.details ?? {});
      toast.show({ message: err.message });
    } finally {
      setSaving(false);
    }
  }

  const opt = rows => (rows ?? []).map(r => ({ value: r.id, label: r.name }));
  return (
    <Dialog open={open} onClose={onClose} title={editing ? `Edit ${item.name}` : 'Add to the shelves'} wide
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" form="item-form" disabled={saving}>Save</Button></>}>
      <form id="item-form" className="form-grid" onSubmit={save} noValidate>
        <Field label="Name" error={errors.name}><TextInput value={form.name} onChange={set('name')} required autoFocus /></Field>
        {editing && (
          <Field label="Store" error={errors.store_id}>
            <Select value={form.store_id} onChange={setStore} options={stores.map(st => ({ value: st.id, label: st.name }))} />
          </Field>
        )}
        <Field label="Unit" error={errors.unit}><Select value={form.unit} onChange={set('unit')} options={UNITS.map(u => ({ value: u, label: u }))} /></Field>
        <Field label="Category" error={errors.category_id}><Select value={form.category_id} onChange={set('category_id')} placeholder="None" options={opt(categories)} /></Field>
        <Field label="Shelf, bin or crock" error={errors.location_id}><Select value={form.location_id} onChange={set('location_id')} placeholder="None" options={opt(locations)} /></Field>
        <Field label="Running low at" hint="Warn me when I have this much or less" error={errors.low_threshold}><NumberInput value={form.low_threshold} onChange={set('low_threshold')} min="0" /></Field>
        <Field label="Notes" className="span-2" error={errors.notes}><TextArea value={form.notes} onChange={set('notes')} /></Field>
        <Checkbox label="Favorite" checked={form.favorite} onChange={set('favorite')} />
        {!editing && (
          <fieldset className="span-2 stitched-set">
            <legend className="hand">First batch (optional)</legend>
            <div className="form-grid">
              <BatchFields form={batch} setField={setB} errors={errors} />
            </div>
          </fieldset>
        )}
        {!editing && (
          <Field label="Photos" className="span-2" hint={files.length ? `${files.length} photo(s) will be added` : 'Optional'}>
            <input type="file" accept="image/*" multiple className="input" onChange={e => setFiles([...e.target.files])} />
          </Field>
        )}
        <FormAlert errors={errors} shown={[...ITEM_KEYS, ...(editing ? ['store_id'] : shownBatchKeys(batch))]} />
      </form>
    </Dialog>
  );
}
