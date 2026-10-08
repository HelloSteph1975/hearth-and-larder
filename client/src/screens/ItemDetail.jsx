import { Fragment, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Camera, Check, Pencil, Plus, Star, Trash2, Undo2 } from 'lucide-react';
import { PageHeader } from '../components/PageHeader.jsx';
import { Button } from '../components/Button.jsx';
import { Card } from '../components/Card.jsx';
import { Badge } from '../components/Badge.jsx';
import { StoreIcon } from '../components/StoreIcon.jsx';
import { PhotoGallery } from '../components/PhotoGallery.jsx';
import { UseByBadge } from '../components/ItemCard.jsx';
import { useDeleteWithUndo } from '../components/useDeleteWithUndo.jsx';
import { useStores } from '../components/StoresProvider.jsx';
import { useToast } from '../components/ToastProvider.jsx';
import { api } from '../lib/api.js';
import { useApi } from '../lib/useApi.js';
import { formatQty, formatMoney } from '../lib/format.js';
import { prettyDate } from '../lib/dates.js';
import { SOURCE_LABELS } from '../lib/options.js';
import { PrintButton, PrintSheet } from '../components/Print.jsx';
import { ItemPrint } from '../components/PrintViews.jsx';
import { usePrint } from '../lib/usePrint.js';
import { ItemForm } from './ItemForm.jsx';
import { BatchForm } from './BatchForm.jsx';
import { NotFound } from './NotFound.jsx';

function unitPrice(p) {
  if (p.price == null || !p.quantity) return '';
  return `${formatMoney(p.price / p.quantity)} / ${p.unit}`;
}

function BatchRow({ b, cols, span, onEdit, onToggle, onDelete, onPhotosChange }) {
  const [showPhotos, setShowPhotos] = useState(false);
  const used = Boolean(b.used_up_at);
  const container = b.container ? `${b.container_count ? `${b.container_count} × ` : ''}${b.container}` : '';
  const photos = b.photos ?? [];
  const what = `batch of ${formatQty(b.quantity)} ${b.unit}`;
  return (
    <>
    <tr className={used ? 'is-used' : ''}>
      <td data-label="Quantity"><strong>{formatQty(b.quantity)}</strong> {b.unit}</td>
      <td data-label="Stored">{b.date_stored ? prettyDate(b.date_stored) : '—'}</td>
      <td data-label="Use by">{b.use_by ? <>{prettyDate(b.use_by)} {!used && <UseByBadge useBy={b.use_by} />}</> : '—'}</td>
      <td data-label="Source">{b.source ? SOURCE_LABELS[b.source] ?? b.source : '—'}{b.method ? <span className="code-line"><br />{b.method}</span> : null}</td>
      <td data-label="Container">{container || (b.batch_code ? null : '—')}{b.notes && <span className="batch-note hand"><br />{b.notes}</span>}{b.batch_code && <span className="code-line">{container ? <br /> : null}Batch {b.batch_code}</span>}</td>
      {cols.price && <td data-label="Price">{b.price != null ? formatMoney(b.price) : '—'}</td>}
      {cols.recipe && <td data-label="Recipe">{b.recipe_id ? <Link to={`/recipes/${b.recipe_id}`}>{b.recipe_title ?? 'Recipe'}</Link> : '—'}</td>}
      <td className="row-actions">
        <Button size="sm" variant="ghost" icon={Pencil} onClick={() => onEdit(b)} aria-label={`Edit batch of ${formatQty(b.quantity)} ${b.unit}`} title="Edit" />
        <Button size="sm" variant="secondary" icon={used ? Undo2 : Check} onClick={() => onToggle(b)}>{used ? 'Put back' : 'Mark used up'}</Button>
        <Button size="sm" variant="ghost" icon={Camera} onClick={() => setShowPhotos(v => !v)} aria-expanded={showPhotos}
          aria-label={`Photos (${photos.length}) for ${what}`}>Photos ({photos.length})</Button>
        <Button size="sm" variant="ghost" icon={Trash2} onClick={() => onDelete(b)} aria-label={`Delete ${what}`} title="Delete" />
      </td>
    </tr>
    {showPhotos && (
      <tr className="batch-photos-row">
        <td colSpan={span}>
          <PhotoGallery ownerType="batch" ownerId={b.id} photos={photos} onChange={onPhotosChange} />
        </td>
      </tr>
    )}
    </>
  );
}

export function ItemDetail() {
  const { id } = useParams();
  const { stores } = useStores();
  const { data: item, loading, error, reload } = useApi(`/api/items/${id}`);
  const navigate = useNavigate();
  const toast = useToast();
  const del = useDeleteWithUndo();
  const [editing, setEditing] = useState(false);
  const [batchDialog, setBatchDialog] = useState(null); // { batch? }
  const printer = usePrint({ ready: Boolean(item) && !loading });

  if (error?.status === 404) return <NotFound />;
  if (error) {
    return (
      <Card tone="butter" className="error-card">
        <p className="error-note">{error.message}</p>
        <Button variant="secondary" onClick={reload}>Try again</Button>
      </Card>
    );
  }
  if (!item) {
    return (
      <div className="detail-grid" aria-busy={loading} aria-label="Loading">
        <span className="skeleton skeleton-card" style={{ height: 260 }} />
        <span className="skeleton skeleton-card" style={{ height: 260 }} />
      </div>
    );
  }

  const store = stores.find(s => s.id === item.store_id);
  const live = item.batches.filter(b => !b.used_up_at);
  const usedUp = item.batches.filter(b => b.used_up_at);
  const hero = item.photos?.[0];

  async function guarded(fn) {
    try { await fn(); reload(); } catch (err) { toast.show({ message: err.message, duration: 6000 }); }
  }
  const toggleFavorite = () => guarded(() => api.patch(`/api/items/${item.id}`, { favorite: !item.favorite }));
  const toggleUsed = b => guarded(() => api.post(`/api/batches/${b.id}/${b.used_up_at ? 'unuse' : 'used-up'}`));
  const deleteBatch = b => del({ url: `/api/batches/${b.id}`, label: `that batch of ${item.name}`, onChange: reload });
  const deleteItem = async () => {
    const done = await del({ url: `/api/items/${item.id}`, label: item.name, onChange: () => window.dispatchEvent(new Event('hl:items-changed')), body: 'Its batches and photos go with it. You can undo this for a few seconds afterward.' });
    if (done) navigate(store ? `/store/${store.id}` : '/');
  };
  const cols = { price: item.batches.some(b => b.price != null), recipe: item.batches.some(b => b.recipe_id) };
  const span = 6 + Number(cols.price) + Number(cols.recipe);
  const rowProps = { cols, span, onEdit: b => setBatchDialog({ batch: b }), onToggle: toggleUsed, onDelete: deleteBatch, onPhotosChange: reload };

  return (
    <>
      <Link to={store ? `/store/${store.id}` : '/'} className="back-link"><ArrowLeft size={16} aria-hidden="true" /> Back to {store?.name ?? 'the hearth'}</Link>
      <PageHeader
        title={item.name}
        note={item.category_name ? `${item.category_name}` : null}
        actions={(
          <>
            <PrintButton onClick={printer.print} busy={printer.preparing} />
            <Button variant="secondary" icon={Pencil} onClick={() => setEditing(true)}>Edit</Button>
            <Button icon={Plus} onClick={() => setBatchDialog({})}>Add batch</Button>
            <Button variant="ghost" icon={Trash2} onClick={deleteItem}>Delete</Button>
          </>
        )}
      />

      <div className="detail-grid">
        <Card className="item-hero">
          <div className="hero-photo">
            {hero ? <img src={`/photos/${hero.filename}`} alt={hero.caption || item.name} /> : <StoreIcon icon={store?.icon} size={84} />}
          </div>
          <div className="hero-body">
            <p className="hero-qty"><strong>{formatQty(item.quantity)}</strong> <span>{item.unit}{item.mixed_units ? ' + more' : ''}</span></p>
            <div className="badges">
              {item.is_low && <Badge tone="tomato">running low</Badge>}
              <UseByBadge useBy={item.next_use_by} />
            </div>
            <dl className="facts">
              <dt>Store</dt><dd>{store?.name ?? item.store_name}</dd>
              {item.location_name && <><dt>Shelf</dt><dd>{item.location_name}</dd></>}
              {item.category_name && <><dt>Category</dt><dd>{item.category_name}</dd></>}
              {item.low_threshold != null && <><dt>Running low at</dt><dd>{formatQty(item.low_threshold)} {item.unit}</dd></>}
            </dl>
            <Button variant={item.favorite ? 'secondary' : 'ghost'} className="fav-toggle" size="sm" icon={Star} aria-pressed={Boolean(item.favorite)} onClick={toggleFavorite}>
              Favorite
            </Button>
          </div>
        </Card>

        <div className="detail-main">
          <section className="detail-section">
            <h2>Batches</h2>
            {live.length === 0 && usedUp.length === 0 ? (
              <Card tone="butter" className="soft-note">
                <p className="hand">No batches yet. Add one when something goes on the shelf.</p>
                <Button icon={Plus} size="sm" onClick={() => setBatchDialog({})}>Add batch</Button>
              </Card>
            ) : (
              <div className="table-wrap">
                <table className="batch-table">
                  <thead>
                    <tr>
                      <th scope="col">Quantity</th><th scope="col">Stored</th><th scope="col">Use by</th><th scope="col">Source</th>
                      <th scope="col">Container</th>{cols.price && <th scope="col">Price</th>}{cols.recipe && <th scope="col">Recipe</th>}
                      <th scope="col"><span className="visually-hidden">Actions</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {live.length === 0 && <tr><td colSpan={span} className="muted">Everything has been used up.</td></tr>}
                    {live.map(b => <BatchRow key={b.id} b={b} {...rowProps} />)}
                    {usedUp.length > 0 && (
                      <Fragment>
                        <tr className="used-divider"><th colSpan={span} scope="colgroup"><span className="hand">Used up</span></th></tr>
                        {usedUp.map(b => <BatchRow key={b.id} b={b} {...rowProps} />)}
                      </Fragment>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {item.notes && (
            <section className="detail-section">
              <h2>Notes</h2>
              <Card tone="butter" className="notes-card"><p className="hand notes-text">{item.notes}</p></Card>
            </section>
          )}

          {item.used_in?.length > 0 && (
            <section className="detail-section">
              <h2>Used in recipes</h2>
              <ul className="chip-list">
                {item.used_in.map(r => <li key={r.id}><Link className="chip" to={`/recipes/${r.id}`}>{r.title}</Link></li>)}
              </ul>
            </section>
          )}

          {item.price_history?.length > 0 && (
            <section className="detail-section">
              <h2>Price history</h2>
              <ul className="price-list">
                {item.price_history.map(p => (
                  <li key={p.batch_id}>
                    <span className="price-date">{p.purchased_on ? prettyDate(p.purchased_on) : '—'}</span>
                    <span className="price-vendor">{p.vendor || 'Somewhere'}</span>
                    <strong>{formatMoney(p.price)}</strong>
                    <span className="muted">{unitPrice(p)}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="detail-section">
            <h2>Photos</h2>
            <PhotoGallery ownerType="item" ownerId={item.id} photos={item.photos ?? []} onChange={reload} />
          </section>
        </div>
      </div>

      {printer.active && <PrintSheet what="Item record"><ItemPrint item={item} storeName={store?.name} /></PrintSheet>}

      <ItemForm open={editing} item={item} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); reload(); window.dispatchEvent(new Event('hl:items-changed')); }} />
      <BatchForm open={Boolean(batchDialog)} item={item} batch={batchDialog?.batch} onClose={() => setBatchDialog(null)}
        onSaved={() => { setBatchDialog(null); reload(); }} />
    </>
  );
}
