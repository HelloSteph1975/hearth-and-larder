import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Minus, Plus, Pencil, Trash2, CookingPot, Heart, CalendarPlus, ShoppingBasket } from 'lucide-react';
import { useApi } from '../lib/useApi.js';
import { api } from '../lib/api.js';
import { formatQty, formatMinutes } from '../lib/format.js';
import { prettyDate } from '../lib/dates.js';
import { Button } from '../components/Button.jsx';
import { Badge } from '../components/Badge.jsx';
import { PageHeader } from '../components/PageHeader.jsx';
import { PhotoGallery } from '../components/PhotoGallery.jsx';
import { NutritionPanel } from '../components/NutritionPanel.jsx';
import { HeartsDisplay } from '../components/Hearts.jsx';
import { useDeleteWithUndo } from '../components/useDeleteWithUndo.jsx';
import { useToast } from '../components/ToastProvider.jsx';
import { AddToPlanDialog } from '../components/AddToPlanDialog.jsx';
import { shortfalls, addShortfallsToList, shortfallMessage } from '../lib/shopping.js';
import { PrintButton, PrintSheet } from '../components/Print.jsx';
import { RecipePrint } from '../components/PrintViews.jsx';
import { usePrint } from '../lib/usePrint.js';
import { CookDialog } from './CookDialog.jsx';

const STATUS = { have: ['garden', 'have it'], partial: ['honey', 'not enough'], check: ['honey', 'check amount'], missing: ['tomato', 'need it'], staple: ['ink', 'staple'] };

function CookingHistory({ rows, onDelete }) {
  return (
    <section className="cook-history" aria-labelledby="h-cook-history">
      <h2 id="h-cook-history">Cooking history</h2>
      {rows.length === 0 ? <p className="hand">Not cooked yet. Tap "I cooked this" when you do.</p> : (
        <ul className="history-list">
          {rows.map(c => (
            <li key={c.id}>
              <span className="history-date">{prettyDate(c.cooked_on)}</span>
              {c.servings ? <span className="muted">{formatQty(c.servings)} servings</span> : null}
              {c.notes && <span className="hand history-note">{c.notes}</span>}
              <button className="icon-btn" aria-label={`Remove the cooking on ${prettyDate(c.cooked_on)}`} onClick={() => onDelete(c)}><Trash2 size={16} /></button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function RecipeDetail() {
  const { id } = useParams();
  return <RecipeDetailInner key={id} id={id} />;
}

function RecipeDetailInner({ id }) {
  const [servings, setServings] = useState(null);
  const [cooking, setCooking] = useState(false);
  const [planning, setPlanning] = useState(false);
  const nav = useNavigate();
  const del = useDeleteWithUndo();
  const toast = useToast();
  const { data: r, error, loading, reload } = useApi(`/api/recipes/${id}${servings ? `?servings=${servings}` : ''}`, { keepPrevious: true });
  const { data: history, reload: reloadHistory } = useApi(`/api/cook-log?recipe_id=${id}`);
  // Cooking changes the shelves, so refresh this page and any open item lists.
  const refresh = () => { reload(); reloadHistory(); window.dispatchEvent(new Event('hl:items-changed')); };
  // Print once the refetch for the chosen servings has landed, so the amounts match the label.
  const printer = usePrint({ ready: Boolean(r) && !loading && (servings == null || r.status.servings === servings) });
  if (error) return <p className="error-card card">{error.message}</p>;
  if (!r) return <div className="skeleton-page skeleton skeleton-card" aria-busy="true" />;
  const s = servings ?? r.status.servings; // local state so quick double-clicks don't race the refetch
  const step = s <= 1 ? 0.5 : 1;
  const toggleFav = async () => {
    try { await api.patch(`/api/recipes/${id}`, { favorite: !r.favorite }); reload(); } catch (err) { toast.show({ message: err.message }); }
  };
  const missing = r.status.missing_names ?? [];
  async function shopForMissing() {
    try {
      toast.show({ message: shortfallMessage(await addShortfallsToList(shortfalls(r.status))) });
    } catch (err) { toast.show({ message: err.message }); }
  }
  const deleteCook = c => del({
    url: `/api/cook-log/${c.id}`, label: `the cooking on ${prettyDate(c.cooked_on)}`, onChange: refresh,
    body: 'What it took from the shelves goes back. You can undo this for a few seconds afterward.',
  });

  let lastSection;
  return (
    <article className="recipe">
      <PageHeader title={r.title}
        note={r.times_made ? `Made ${r.times_made} time${r.times_made === 1 ? '' : 's'} · last on ${prettyDate(r.last_made)}` : 'Not made yet'}
        actions={<>
          <Button variant="ghost" className="fav-toggle" icon={Heart} onClick={toggleFav} aria-pressed={Boolean(r.favorite)}>{r.favorite ? 'Favorite' : 'Add to favorites'}</Button>
          <PrintButton onClick={printer.print} busy={printer.preparing} />
          <Button variant="secondary" icon={CalendarPlus} onClick={() => setPlanning(true)}>Plan it</Button>
          <Button variant="secondary" icon={Pencil} onClick={() => nav(`/recipes/${id}/edit`)}>Edit</Button>
          <Button variant="danger" icon={Trash2} onClick={async () => { if (await del({ url: `/api/recipes/${id}`, label: r.title, onChange: () => window.dispatchEvent(new Event('hl:recipes-changed')) })) nav('/recipes'); }}>Delete</Button>
        </>} />
      <div className="recipe-card">
        {r.description && <p className="lede">{r.description}</p>}
        <div className="recipe-meta">
          {r.prep_minutes ? <span>Prep {formatMinutes(r.prep_minutes)}</span> : null}
          {r.cook_minutes ? <span>Cook {formatMinutes(r.cook_minutes)}</span> : null}
          <HeartsDisplay value={r.rating} />
          {r.is_family_recipe ? <Badge tone="tomato">family recipe</Badge> : null}
          {r.tags.map(t => <Link key={t} to={`/recipes?tag=${encodeURIComponent(t)}`} className="tag">{t}</Link>)}
          {r.source_credit && <span className="hand credit">from {r.source_credit}</span>}
        </div>
        <div className="recipe-grid">
          <section className="recipe-ingredients">
            <h2>Ingredients</h2>
            <div className="servings">
              <button className="icon-btn" aria-label="Fewer servings" onClick={() => setServings(Math.max(0.5, s - step))}><Minus size={18} /></button>
              <span><strong>{formatQty(s)}</strong> servings</span>
              <button className="icon-btn" aria-label="More servings" onClick={() => setServings(s + (s < 1 ? 0.5 : 1))}><Plus size={18} /></button>
            </div>
            <ul className="ingredients">
              {r.status.ingredients.map(i => {
                const head = i.section && i.section !== lastSection ? <li className="ing-section hand" key={`s-${i.id}`}>{i.section}</li> : null;
                lastSection = i.section;
                const [tone, label] = STATUS[i.status] ?? STATUS.check;
                return [head, (
                  <li key={i.id} className={`ing ing-${i.status}`}>
                    <span className="ing-main">
                      <span className="ing-qty">{formatQty(i.scaled_quantity)}</span> <span className="ing-unit">{i.unit}</span>{' '}
                      <span className="ing-name">{i.name}</span>{i.prep_note && <span className="muted">, {i.prep_note}</span>}
                      {i.optional ? <span className="muted"> (optional)</span> : null}
                    </span>
                    <Badge tone={tone}>{label}</Badge>
                  </li>
                )];
              })}
            </ul>
            {missing.length > 0 && (
              <div className="missing-note">
                <p className="hand">Short on {missing.join(', ')}.</p>
                <Button variant="secondary" size="sm" icon={ShoppingBasket} onClick={shopForMissing}>Add to shopping list</Button>
              </div>
            )}
            <Button icon={CookingPot} onClick={() => setCooking(true)}>I cooked this</Button>
          </section>
          <section className="recipe-method">
            <h2>Method</h2>
            {r.steps.length ? <ol className="steps">{r.steps.map(st => <li key={st.id}>{st.text}</li>)}</ol> : <p className="muted">No steps written down yet.</p>}
            {r.notes && <><h2>Notes</h2><p className="hand-note">{r.notes}</p></>}
          </section>
        </div>
      </div>
      <div className="recipe-extras">
        <div className="extras-side">
          <NutritionPanel recipe={r} servings={s} />
          <CookingHistory rows={Array.isArray(history) ? history : []} onDelete={deleteCook} />
        </div>
        <section>
          <h2>Photos</h2>
          <PhotoGallery ownerType="recipe" ownerId={r.id} photos={r.photos} onChange={reload} />
        </section>
      </div>
      <CookDialog open={cooking} recipe={r} servings={s} onClose={() => setCooking(false)} onDone={() => { setCooking(false); refresh(); }} onChanged={refresh} />
      {printer.active && <PrintSheet what="Recipe card"><RecipePrint recipe={r} servings={r.status.servings} /></PrintSheet>}
      <AddToPlanDialog open={planning} recipe={r} servings={s} onClose={() => setPlanning(false)} />
    </article>
  );
}
