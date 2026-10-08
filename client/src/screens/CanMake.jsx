import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ShoppingBasket } from 'lucide-react';
import { PageHeader } from '../components/PageHeader.jsx';
import { Button } from '../components/Button.jsx';
import { EmptyState } from '../components/EmptyState.jsx';
import { RecipeCard } from '../components/RecipeCard.jsx';
import { useToast } from '../components/ToastProvider.jsx';
import { useApi } from '../lib/useApi.js';
import { formatMinutes } from '../lib/format.js';
import { shortfalls, addShortfallsToList, shortfallMessage } from '../lib/shopping.js';

function ShortList({ recipes, onAdd }) {
  return (
    <ul className="short-list">
      {recipes.map(r => (
        <li key={r.id} className="card short-card">
          <div>
            <h3><Link to={`/recipes/${r.id}`}>{r.title}</Link></h3>
            {r.total_minutes ? <p className="muted short-time">{formatMinutes(r.total_minutes)}</p> : null}
            <p className="hand">Needs {r.status.missing_names.join(', ')}</p>
          </div>
          <Button variant="secondary" size="sm" icon={ShoppingBasket} onClick={() => onAdd(r)}>Add to shopping list</Button>
        </li>
      ))}
    </ul>
  );
}

export function CanMake() {
  const { data, error, reload } = useApi('/api/can-make');
  const toast = useToast();
  const [showRest, setShowRest] = useState(false);

  async function addMissing(r) {
    try {
      const res = await addShortfallsToList(shortfalls(r.status));
      toast.show({ message: shortfallMessage(res, r.title) });
    } catch (err) { toast.show({ message: err.message }); }
  }

  if (error) return <div className="card error-card"><p className="error-note">{error.message}</p><Button variant="secondary" onClick={reload}>Try again</Button></div>;
  if (!data) return <div className="grid-cards" aria-busy="true" aria-label="Loading">{[0, 1, 2].map(i => <span key={i} className="skeleton skeleton-card" />)}</div>;

  const ready = data.filter(r => r.status.can_make);
  const rest = data.filter(r => !r.status.can_make);
  const almost = rest.filter(r => r.status.missing_names.length <= 2);
  const far = rest.filter(r => r.status.missing_names.length > 2);
  const stock = r => ({ have: r.status.counts.have ?? 0, total: r.ingredients.filter(i => !i.is_staple).length, can_make: r.status.can_make });

  return (
    <>
      <PageHeader title="What can I make?" note="Based on what is on your shelves right now" />
      {data.length === 0 ? (
        <EmptyState art="recipeBox" title="No recipes to check yet" body="Add a recipe with ingredients and I will tell you what you can cook tonight."
          action={<Button as={Link} to="/recipes/new">New recipe</Button>} />
      ) : (
        <>
          <section className="can-group">
            <h2>Ready to cook</h2>
            {ready.length ? (
              <div className="grid-cards">{ready.map(r => <RecipeCard key={r.id} recipe={{ ...r, stock: stock(r) }} />)}</div>
            ) : <p className="hand">Nothing is fully stocked yet. Look at the next group for what is close.</p>}
          </section>
          {almost.length > 0 && (
            <section className="can-group">
              <h2>Almost there</h2>
              <ShortList recipes={almost} onAdd={addMissing} />
            </section>
          )}
          {far.length > 0 && (
            <section className="can-group">
              <h2>
                <button type="button" className="disclosure" aria-expanded={showRest} onClick={() => setShowRest(v => !v)}>
                  <ChevronDown size={20} aria-hidden="true" /> Needs a shop <span className="muted">({far.length})</span>
                </button>
              </h2>
              {showRest && <ShortList recipes={far} onAdd={addMissing} />}
            </section>
          )}
        </>
      )}
    </>
  );
}
