import { formatQty, formatMinutes, formatMoney } from '../lib/format.js';
import { prettyDate } from '../lib/dates.js';
import { SOURCE_LABELS } from '../lib/options.js';
import { NUTRIENTS } from './NutritionPanel.jsx';
import { SLOTS, SLOT_LABEL } from './AddToPlanDialog.jsx';

const dash = '—';
// Paper keeps longer than a week, so tables carry the year: "3 Sep 2027".
export function shortDate(iso) {
  if (!iso) return '';
  const [, d, mon] = prettyDate(iso.slice(0, 10)).split(' ');
  return `${d} ${mon} ${iso.slice(0, 4)}`;
}
const day = iso => (iso ? shortDate(iso) : dash);
// "each" reads oddly on a card ("2 each eggs"), so a counted thing prints as just the number.
const qtyUnit = (qty, unit) => [qty, unit === 'each' ? '' : unit].filter(Boolean).join(' ');
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

// Consecutive ingredients with the same section print together under one heading.
function sectionGroups(ingredients) {
  const groups = [];
  for (const ing of ingredients) {
    const last = groups[groups.length - 1];
    if (last && (last.section ?? '') === (ing.section ?? '')) last.items.push(ing);
    else groups.push({ section: ing.section ?? '', items: [ing] });
  }
  return groups;
}

/* ---------- Recipe card ---------- */

export function RecipePrint({ recipe: r, servings }) {
  const ingredients = r.status?.ingredients ?? r.ingredients ?? [];
  const shownServings = servings ?? r.status?.servings ?? r.servings;
  const photo = r.photos?.[0]?.filename ?? r.photo;
  const total = (r.prep_minutes ?? 0) + (r.cook_minutes ?? 0);
  const nutrition = NUTRIENTS.filter(([k]) => r[k] != null);
  return (
    <article className="print-recipe" aria-label={r.title}>
      <header className="print-recipe-head">
        <div className="print-recipe-titles">
          <h2 className="print-title">{r.title}</h2>
          {r.description && <p className="print-lede">{r.description}</p>}
          <ul className="print-meta">
            {shownServings ? <li><strong>{formatQty(shownServings)}</strong> servings</li> : null}
            {r.prep_minutes ? <li>Prep {formatMinutes(r.prep_minutes)}</li> : null}
            {r.cook_minutes ? <li>Cook {formatMinutes(r.cook_minutes)}</li> : null}
            {r.prep_minutes && r.cook_minutes ? <li>Total {formatMinutes(total)}</li> : null}
            {r.is_family_recipe ? <li className="print-family">Family recipe</li> : null}
          </ul>
          {r.source_credit && <p className="print-credit hand">from {r.source_credit}</p>}
        </div>
        {photo && <img className="print-recipe-photo" src={`/photos/${photo}`} alt="" />}
      </header>
      <div className="print-recipe-body">
        <section className="print-ingredients" aria-label="Ingredients">
          <h3>Ingredients</h3>
          {ingredients.length === 0 ? <p className="print-quiet">None written down.</p> : sectionGroups(ingredients).map((g, gi) => (
            <div className="print-ing-group" key={`${g.section}-${gi}`}>
              {g.section && <h4 className="print-section hand">{g.section}</h4>}
              <ul>
                {g.items.map(i => {
                  const qty = formatQty(i.scaled_quantity ?? i.quantity);
                  return (
                    <li key={i.id}>
                      {qtyUnit(qty, i.unit) && <span className="print-qty">{qtyUnit(qty, i.unit)}</span>}{' '}
                      <span className="print-ing-name">{i.name}</span>
                      {i.prep_note && <span className="print-quiet">, {i.prep_note}</span>}
                      {i.optional ? <span className="print-quiet"> (optional)</span> : null}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </section>
        <section className="print-method" aria-label="Method">
          <h3>Method</h3>
          {r.steps?.length ? <ol className="print-steps">{r.steps.map(st => <li key={st.id}>{st.text}</li>)}</ol>
            : <p className="print-quiet">No steps written down yet.</p>}
          {r.notes && (
            <div className="print-notes">
              <h3>Notes</h3>
              <p className="hand">{r.notes}</p>
            </div>
          )}
        </section>
      </div>
      {nutrition.length > 0 && (
        <section className="print-nutrition" aria-label="Nutrition per serving">
          <h3>Nutrition per serving</h3>
          <dl>
            {nutrition.map(([k, label, unit]) => (
              <div key={k}><dt>{label}</dt><dd>{Math.round(r[k] * 10) / 10}{unit}</dd></div>
            ))}
          </dl>
        </section>
      )}
    </article>
  );
}

/* ---------- Store inventory ---------- */

export function InventoryPrint({ store, items, filters = [] }) {
  return (
    <section className="print-block" aria-label={`${store.name} inventory`}>
      <h2 className="print-title">{store.name}</h2>
      <p className="print-sub">{plural(items.length, 'item')}{filters.length ? ` · ${filters.join(' · ')}` : ''}</p>
      {items.length === 0 ? <p className="print-quiet">Nothing to list.</p> : (
        <table className="print-table">
          <thead>
            <tr>
              <th scope="col">Item</th><th scope="col">Category</th><th scope="col">Shelf</th>
              <th scope="col" className="num">Quantity</th><th scope="col">Next use-by</th><th scope="col">Source</th>
              <th scope="col">Low</th>
            </tr>
          </thead>
          <tbody>
            {items.map(i => (
              <tr key={i.id} className={i.is_low ? 'is-low' : undefined}>
                <th scope="row">{i.name}</th>
                <td>{i.category_name || dash}</td>
                <td>{i.location_name || dash}</td>
                <td className="num">{qtyUnit(formatQty(i.quantity), i.unit) || dash}{i.mixed_units ? ' + more' : ''}</td>
                <td>{day(i.next_use_by)}</td>
                <td>{(i.sources ?? []).map(s => SOURCE_LABELS[s] ?? s).join(', ') || dash}</td>
                <td>{i.is_low ? <span className="print-flag">● running low</span> : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

/* ---------- Item record ---------- */

const BATCH_COLUMNS = [
  ['quantity', 'Quantity', b => `${formatQty(b.quantity)} ${b.unit ?? ''}`.trim(), true],
  ['stored', 'Stored', b => shortDate(b.date_stored), true],
  ['use_by', 'Use by', b => shortDate(b.use_by), true],
  ['source', 'Source', b => b.source && (SOURCE_LABELS[b.source] ?? b.source)],
  ['method', 'Method', b => b.method],
  ['container', 'Container', b => b.container && `${b.container_count ? `${b.container_count} × ` : ''}${b.container}`],
  ['code', 'Batch', b => b.batch_code],
  ['price', 'Price', b => (b.price != null ? formatMoney(b.price) : '')],
  ['vendor', 'Vendor', b => b.vendor],
  ['recipe', 'Recipe', b => b.recipe_id && (b.recipe_title ?? 'Recipe')],
  ['notes', 'Notes', b => b.notes],
];

function unitPrice(p) {
  if (p.price == null || !p.quantity) return '';
  return `${formatMoney(p.price / p.quantity)} / ${p.unit}`;
}

export function ItemPrint({ item, storeName }) {
  const batches = item.batches ?? [];
  // Only the columns this item actually uses, so a plain jar of honey doesn't print a wall of dashes.
  const cols = BATCH_COLUMNS.filter(([, , get, always]) => always || batches.some(b => get(b)));
  const live = batches.filter(b => !b.used_up_at);
  const used = batches.filter(b => b.used_up_at);
  const row = b => (
    <tr key={b.id} className={b.used_up_at ? 'is-used' : undefined}>
      {cols.map(([key, , get]) => {
        const v = get(b);
        if (key === 'quantity') {
          return <td key={key} className="print-nowrap"><strong>{v}</strong>{b.used_up_at ? <span className="print-flag is-quiet print-used">used up {shortDate(b.used_up_at)}</span> : null}</td>;
        }
        if (key === 'notes' && v) return <td key={key} className="hand print-cell-note">{v}</td>;
        return <td key={key} className={['stored', 'use_by', 'code', 'price'].includes(key) ? 'print-nowrap' : undefined}>{v || dash}</td>;
      })}
    </tr>
  );
  return (
    <section className="print-block" aria-label={`${item.name} record`}>
      <h2 className="print-title">{item.name}</h2>
      <dl className="print-facts">
        <div><dt>Store</dt><dd>{storeName ?? item.store_name ?? dash}</dd></div>
        <div><dt>Category</dt><dd>{item.category_name || dash}</dd></div>
        <div><dt>Shelf</dt><dd>{item.location_name || dash}</dd></div>
        <div><dt>On hand</dt><dd>{formatQty(item.quantity)} {item.unit}{item.mixed_units ? ' + more' : ''}{item.is_low ? <span className="print-flag"> ● running low</span> : null}</dd></div>
        <div><dt>Running low at</dt><dd>{item.low_threshold != null ? `${formatQty(item.low_threshold)} ${item.unit}` : dash}</dd></div>
        <div><dt>Next use-by</dt><dd>{day(item.next_use_by)}</dd></div>
      </dl>
      {item.notes && <div className="print-notes"><h3>Notes</h3><p className="hand">{item.notes}</p></div>}

      <h3>Batches</h3>
      {batches.length === 0 ? <p className="print-quiet">No batches yet.</p> : (
        <table className="print-table print-batches">
          <thead>
            <tr>{cols.map(([key, label]) => <th key={key} scope="col">{label}</th>)}</tr>
          </thead>
          <tbody>
            {live.map(row)}
            {used.length > 0 && <tr className="print-divider"><th colSpan={cols.length} scope="colgroup">Used up</th></tr>}
            {used.map(row)}
          </tbody>
        </table>
      )}

      {item.price_history?.length > 0 && (
        <>
          <h3>Price history</h3>
          <table className="print-table print-prices">
            <thead><tr><th scope="col">Bought</th><th scope="col">Vendor</th><th scope="col" className="num">Price</th><th scope="col" className="num">Unit price</th></tr></thead>
            <tbody>
              {item.price_history.map(p => (
                <tr key={p.batch_id}>
                  <td>{day(p.purchased_on)}</td><td>{p.vendor || 'Somewhere'}</td>
                  <td className="num">{formatMoney(p.price)}</td><td className="num">{unitPrice(p) || dash}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </section>
  );
}

/* ---------- Meal plan ---------- */

export function PlanPrint({ days, entries }) {
  const grid = {};
  for (const e of entries ?? []) (grid[`${e.date}|${e.slot}`] ??= []).push(e);
  return (
    <section className="print-block" aria-label="Meal plan">
      <h2 className="print-title">Week of {prettyDate(days[0])}</h2>
      <p className="print-sub">{prettyDate(days[0])} to {prettyDate(days[6])} · {plural((entries ?? []).length, 'meal')} planned</p>
      <table className="print-table print-plan">
        <thead>
          <tr>
            <td className="print-plan-corner" />
            {days.map(d => {
              const [wd, num, mon] = prettyDate(d).split(' ');
              return <th key={d} scope="col"><span className="print-plan-wd">{wd}</span> {num} {mon}</th>;
            })}
          </tr>
        </thead>
        <tbody>
          {SLOTS.map(slot => (
            <tr key={slot}>
              <th scope="row" className="hand">{SLOT_LABEL[slot]}</th>
              {days.map(d => (
                <td key={d} data-cell={`${d}|${slot}`}>
                  {(grid[`${d}|${slot}`] ?? []).map(e => (
                    <div key={e.id} className="print-plan-entry">
                      {e.recipe_id ? <strong>{e.recipe_title}</strong> : null}
                      {e.servings ? <span className="print-quiet"> · serves {formatQty(e.servings)}</span> : null}
                      {e.note && <span className={`hand print-plan-note${e.recipe_id ? '' : ' is-only'}`}>{e.note}</span>}
                    </div>
                  ))}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

/* ---------- Recipe index ---------- */

export function RecipeIndexPrint({ recipes, filters = [] }) {
  return (
    <section className="print-block" aria-label="Recipe index">
      <h2 className="print-title">Recipe Box</h2>
      <p className="print-sub">{plural(recipes.length, 'recipe')}{filters.length ? ` · ${filters.join(' · ')}` : ''}</p>
      {recipes.length === 0 ? <p className="print-quiet">No recipes to list.</p> : (
        <table className="print-table">
          <thead>
            <tr><th scope="col">Recipe</th><th scope="col">Tags</th><th scope="col">Total time</th><th scope="col" className="num">Servings</th><th scope="col">Last made</th></tr>
          </thead>
          <tbody>
            {recipes.map(r => (
              <tr key={r.id}>
                <th scope="row">{r.title}{r.is_family_recipe ? <span className="print-quiet"> · family</span> : null}</th>
                <td>{(r.tags ?? []).join(', ') || dash}</td>
                <td>{formatMinutes(r.total_minutes) || dash}</td>
                <td className="num">{r.servings ? formatQty(r.servings) : dash}</td>
                <td className="print-nowrap">{r.last_made ? shortDate(r.last_made) : 'not yet'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
