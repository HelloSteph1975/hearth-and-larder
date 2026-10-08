import { useEffect, useState } from 'react';
import { Dialog } from '../components/Dialog.jsx';
import { Button } from '../components/Button.jsx';
import { BatchFields, FormAlert, batchPayload, shownBatchKeys } from '../components/BatchFields.jsx';
import { useApi } from '../lib/useApi.js';
import { api } from '../lib/api.js';
import { todayISO } from '../lib/dates.js';
import { useToast } from '../components/ToastProvider.jsx';

const FIELDS = ['quantity', 'unit', 'date_stored', 'use_by', 'source', 'method', 'container', 'container_count', 'batch_code', 'recipe_id', 'notes', 'price', 'vendor', 'purchased_on'];

function initial(item, batch) {
  if (batch) return Object.fromEntries(FIELDS.map(k => [k, batch[k] ?? '']));
  return {
    quantity: '', unit: item.unit || 'each', date_stored: todayISO(), use_by: '', source: '', method: '', container: '',
    container_count: '', batch_code: '', recipe_id: '', notes: '', price: '', vendor: '', purchased_on: '',
  };
}

export function BatchForm({ open, onClose, onSaved, item, batch }) {
  const editing = Boolean(batch);
  const [form, setForm] = useState({});
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const toast = useToast();
  const { data: recipes } = useApi(open ? '/api/recipes' : null);

  useEffect(() => {
    if (!open) return;
    setForm(initial(item, batch));
    setErrors({});
  }, [open, item, batch]);

  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }));

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    const body = { ...batchPayload(form), recipe_id: form.recipe_id || null, unit: form.unit || item.unit || 'each' };
    try {
      const saved = editing ? await api.patch(`/api/batches/${batch.id}`, body) : await api.post('/api/batches', { ...body, item_id: item.id });
      toast.show({ message: editing ? 'Saved that batch' : `Added a batch of ${item.name}` });
      onSaved(saved);
    } catch (err) {
      setErrors(err.details ?? {});
      toast.show({ message: err.message });
    } finally {
      setSaving(false);
    }
  }

  const recipeList = recipes ?? [];
  return (
    <Dialog open={open} onClose={onClose} title={editing ? `Edit batch of ${item.name}` : `New batch of ${item.name}`} wide
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" form="batch-form" disabled={saving}>Save</Button></>}>
      <form id="batch-form" className="form-grid" onSubmit={save} noValidate>
        <BatchFields form={form} setField={setField} errors={errors} recipes={recipeList} showUnit showNotes />
        <FormAlert errors={errors} shown={shownBatchKeys(form, ['unit', 'recipe_id', 'notes'])} />
      </form>
    </Dialog>
  );
}
