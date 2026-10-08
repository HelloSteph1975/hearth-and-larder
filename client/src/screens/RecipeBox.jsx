import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';
import { PageHeader } from '../components/PageHeader.jsx';
import { Button } from '../components/Button.jsx';
import { EmptyState } from '../components/EmptyState.jsx';
import { RecipeCard } from '../components/RecipeCard.jsx';
import { useApi } from '../lib/useApi.js';

const FILTERS = [
  ['', 'All'], ['favorites', 'Favorites'], ['family', 'Family recipes'], ['can_make', 'Can make now'],
];
const FILTER_PARAM = { favorites: 'favorite=1', family: 'family=1', can_make: 'can_make=1' };

export function RecipeBox() {
  const [params, setParams] = useSearchParams();
  const tag = params.get('tag') ?? '';
  const filter = params.get('filter') ?? '';
  const q = params.get('q') ?? '';
  const [search, setSearch] = useState(q);

  useEffect(() => {
    const t = setTimeout(() => {
      if (search.trim() === q) return;
      setParams(p => { const n = new URLSearchParams(p); if (search.trim()) n.set('q', search.trim()); else n.delete('q'); return n; }, { replace: true });
    }, 250);
    return () => clearTimeout(t);
  }, [search, q, setParams]);

  const url = new URLSearchParams(FILTER_PARAM[filter] ?? '');
  if (q) url.set('q', q);
  if (tag) url.set('tag', tag);
  const { data: recipes, loading, error, reload } = useApi(`/api/recipes?${url}`, { keepPrevious: true });
  const { data: tags, reload: reloadTags } = useApi('/api/recipes/tags');

  // An Undo from the recipe page (after we navigated here) brings the recipe back into this list.
  useEffect(() => {
    const again = () => { reload(); reloadTags(); };
    window.addEventListener('hl:recipes-changed', again);
    return () => window.removeEventListener('hl:recipes-changed', again);
  }, [reload, reloadTags]);

  const setParam = (key, value) => setParams(p => { const n = new URLSearchParams(p); if (value) n.set(key, value); else n.delete(key); return n; });
  const filtered = Boolean(q || tag || filter);
  const clear = () => { setSearch(''); setParams({}); };
  const newButton = <Button as={Link} to="/recipes/new" icon={Plus}>New recipe</Button>;
  const note = recipes && !filtered && recipes.length ? `${recipes.length} card${recipes.length === 1 ? '' : 's'} in the box` : null;

  return (
    <>
      <PageHeader title="Recipe Box" note={note} actions={<><Button as={Link} to="/can-make" variant="secondary">What can I make?</Button>{newButton}</>} />
      <div className="toolbar" role="search">
        <label className="search-box">
          <Search size={18} aria-hidden="true" />
          <span className="visually-hidden">Search recipes</span>
          <input className="input" type="search" placeholder="Search recipes…" value={search} onChange={e => setSearch(e.target.value)} />
        </label>
      </div>
      <div className="chip-row" role="group" aria-label="Filter recipes">
        {FILTERS.map(([value, label]) => (
          <button key={label} type="button" className="filter-chip" aria-pressed={filter === value} onClick={() => setParam('filter', value)}>{label}</button>
        ))}
        {(tags ?? []).length > 0 && <span className="chip-divider" aria-hidden="true" />}
        {(tags ?? []).map(t => (
          <button key={t} type="button" className="filter-chip is-tag" aria-pressed={tag === t} onClick={() => setParam('tag', tag === t ? '' : t)}>{t}</button>
        ))}
      </div>

      {error ? (
        <div className="card error-card"><p className="error-note">{error.message}</p><Button variant="secondary" onClick={reload}>Try again</Button></div>
      ) : !recipes && loading ? (
        <div className="grid-cards" aria-busy="true" aria-label="Loading">{[0, 1, 2].map(i => <span key={i} className="skeleton skeleton-card" />)}</div>
      ) : recipes && recipes.length === 0 ? (
        filtered ? (
          <EmptyState art="recipeBox" title="No recipes match" body="Nothing in the box fits that. Try a different filter or search."
            action={<Button variant="secondary" onClick={clear}>Clear filters</Button>} />
        ) : (
          <EmptyState art="recipeBox" title="Your recipe box is empty" body="Write down the first one, or paste in a list of ingredients and tidy it up." action={newButton} />
        )
      ) : (
        <div className={`grid-cards recipe-grid-cards${loading ? ' is-refreshing' : ''}`}>
          {recipes?.map(r => <RecipeCard key={r.id} recipe={r} />)}
        </div>
      )}
    </>
  );
}
