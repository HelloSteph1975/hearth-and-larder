import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';
import { PageHeader } from '../components/PageHeader.jsx';
import { Button } from '../components/Button.jsx';
import { Card } from '../components/Card.jsx';
import { EmptyState } from '../components/EmptyState.jsx';
import { ItemCard } from '../components/ItemCard.jsx';
import { StoreIcon } from '../components/StoreIcon.jsx';
import { useStores } from '../components/StoresProvider.jsx';
import { Checkbox, Select } from '../components/Field.jsx';
import { useApi } from '../lib/useApi.js';
import { SOURCES, SOURCE_LABELS } from '../lib/options.js';
import { PrintButton, PrintSheet } from '../components/Print.jsx';
import { InventoryPrint } from '../components/PrintViews.jsx';
import { usePrint } from '../lib/usePrint.js';
import { ItemForm } from './ItemForm.jsx';
import { NotFound } from './NotFound.jsx';

const ART = { jar: 'jar', potato: 'potato', wheat: 'wheat' };
const NO_FILTERS = { q: '', category_id: '', location_id: '', source: '', low: false, sort: 'name' };

function SkeletonCards() {
  return (
    <div className="grid-cards" aria-busy="true" aria-label="Loading">
      {[0, 1, 2].map(i => <span key={i} className="skeleton skeleton-card" />)}
    </div>
  );
}

export function StoreScreen() {
  const { storeId } = useParams();
  const { stores, loading: storesLoading } = useStores();
  const store = stores.find(s => String(s.id) === storeId);
  const navigate = useNavigate();
  const [filters, setFilters] = useState(NO_FILTERS);
  const [search, setSearch] = useState('');
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setFilters(f => (f.q === search.trim() ? f : { ...f, q: search.trim() })), 250);
    return () => clearTimeout(t);
  }, [search]);

  const { data: categories } = useApi('/api/categories?kind=item');
  const { data: locations } = useApi(`/api/locations?store_id=${storeId}`);

  const params = new URLSearchParams({ store_id: storeId, sort: filters.sort });
  for (const k of ['q', 'category_id', 'location_id', 'source']) if (filters[k]) params.set(k, filters[k]);
  if (filters.low) params.set('low', '1');
  const { data: items, loading, error, reload } = useApi(`/api/items?${params}`, { keepPrevious: true });

  // An Undo from the item page (after we navigated here) brings the item back into this list.
  useEffect(() => {
    window.addEventListener('hl:items-changed', reload);
    return () => window.removeEventListener('hl:items-changed', reload);
  }, [reload]);

  const setF = k => e => setFilters(f => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const filtered = Boolean(filters.q || filters.category_id || filters.location_id || filters.source || filters.low);
  const clear = () => { setSearch(''); setFilters(NO_FILTERS); };
  const opt = rows => (rows ?? []).map(r => ({ value: r.id, label: r.name }));

  const printer = usePrint({ ready: Boolean(items) && !loading });

  if (!store && storesLoading) return <SkeletonCards />;
  if (!store) return <NotFound />;

  const count = items?.length ?? 0;
  const addButton = <Button icon={Plus} onClick={() => setAdding(true)}>Add item</Button>;
  const nameOf = (rows, id) => rows?.find(r => String(r.id) === String(id))?.name;
  const filterNotes = [
    filters.q && `matching "${filters.q}"`,
    filters.category_id && nameOf(categories, filters.category_id),
    filters.location_id && nameOf(locations, filters.location_id),
    filters.source && SOURCE_LABELS[filters.source],
    filters.low && 'running low only',
  ].filter(Boolean);
  const note = items && !filtered ? (count === 0 ? 'Room for plenty more' : `${count} ${count === 1 ? 'thing' : 'things'} on the shelves`) : null;

  return (
    <>
      <PageHeader
        className="store-accent"
        style={store.color ? { '--store-color': store.color } : undefined}
        title={<span className="title-with-icon"><StoreIcon icon={store.icon} size={34} /> {store.name}</span>}
        note={note}
        actions={<>{count > 0 && <PrintButton onClick={printer.print} busy={printer.preparing} />}{addButton}</>}
      />

      <div className="toolbar" role="search">
        <label className="search-box">
          <Search size={18} aria-hidden="true" />
          <span className="visually-hidden">Search {store.name}</span>
          <input className="input" type="search" placeholder="Search by name…" value={search} onChange={e => setSearch(e.target.value)} />
        </label>
        <label className="toolbar-field"><span className="visually-hidden">Category</span>
          <Select value={filters.category_id} onChange={setF('category_id')} placeholder="All categories" options={opt(categories)} /></label>
        <label className="toolbar-field"><span className="visually-hidden">Location</span>
          <Select value={filters.location_id} onChange={setF('location_id')} placeholder="All shelves" options={opt(locations)} /></label>
        <label className="toolbar-field"><span className="visually-hidden">Source</span>
          <Select value={filters.source} onChange={setF('source')} placeholder="Any source" options={SOURCES.map(s => ({ value: s, label: SOURCE_LABELS[s] }))} /></label>
        <label className="toolbar-field"><span className="visually-hidden">Sort by</span>
          <Select value={filters.sort} onChange={setF('sort')} options={[{ value: 'name', label: 'Sort: Name' }, { value: 'use_by', label: 'Sort: Use-by soonest' }, { value: 'quantity', label: 'Sort: Quantity' }]} /></label>
        <Checkbox label="Running low only" checked={filters.low} onChange={setF('low')} />
      </div>

      {error ? (
        <Card tone="butter" className="error-card">
          <p className="error-note">{error.message}</p>
          <Button variant="secondary" onClick={reload}>Try again</Button>
        </Card>
      ) : !items && loading ? (
        <SkeletonCards />
      ) : items && items.length === 0 ? (
        filtered ? (
          <EmptyState art={ART[store.icon] ?? 'basket'} title="No matches"
            body="Nothing here fits those filters. Try loosening them."
            action={<Button variant="secondary" onClick={clear}>Clear filters</Button>} />
        ) : (
          <EmptyState art={ART[store.icon] ?? 'basket'} title="Nothing on these shelves yet"
            body={`Add your first jar, sack or bundle to the ${store.name}.`} action={addButton} />
        )
      ) : (
        <div className={`grid-cards${loading ? ' is-refreshing' : ''}`}>
          {items?.map(item => <ItemCard key={item.id} item={item} storeIcon={store.icon} />)}
        </div>
      )}

      {printer.active && items && (
        <PrintSheet what="Inventory"><InventoryPrint store={store} items={items} filters={filterNotes} /></PrintSheet>
      )}

      <ItemForm open={adding} storeId={store.id} onClose={() => setAdding(false)}
        onSaved={saved => { setAdding(false); reload(); if (saved?.id) navigate(`/item/${saved.id}`); }} />
    </>
  );
}
