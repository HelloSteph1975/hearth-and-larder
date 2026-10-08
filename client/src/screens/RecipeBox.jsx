import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Plus, Search, SquareCheck } from 'lucide-react';
import { PageHeader } from '../components/PageHeader.jsx';
import { Button } from '../components/Button.jsx';
import { EmptyState } from '../components/EmptyState.jsx';
import { RecipeCard } from '../components/RecipeCard.jsx';
import { PrintButton, PrintFooter, PrintGate, PrintHeader } from '../components/Print.jsx';
import { RecipeIndexPrint, RecipePrint } from '../components/PrintViews.jsx';
import { useToast } from '../components/ToastProvider.jsx';
import { useApi } from '../lib/useApi.js';
import { api } from '../lib/api.js';
import { usePrint } from '../lib/usePrint.js';

const FILTERS = [
  ['', 'All'], ['favorites', 'Favorites'], ['family', 'Family recipes'], ['can_make', 'Can make now'],
];
const FILTER_PARAM = { favorites: 'favorite=1', family: 'family=1', can_make: 'can_make=1' };
const FILTER_NOTE = { favorites: 'favorites', family: 'family recipes', can_make: 'can make now' };

export function RecipeBox() {
  const [params, setParams] = useSearchParams();
  const tag = params.get('tag') ?? '';
  const filter = params.get('filter') ?? '';
  const q = params.get('q') ?? '';
  const [search, setSearch] = useState(q);
  const [seenQ, setSeenQ] = useState(q);
  const written = useRef(null); // a q the debounce below has written but this render hasn't seen yet

  // Back and Forward change q without any typing: show that search instead of writing the old one back.
  if (q !== seenQ) {
    setSeenQ(q);
    if (q === written.current) written.current = null; // our own write arriving
    else if (search.trim() !== q) setSearch(q);
  }

  useEffect(() => {
    const t = setTimeout(() => {
      if (search.trim() === q) return;
      written.current = search.trim();
      setParams(p => { const n = new URLSearchParams(p); if (search.trim()) n.set('q', search.trim()); else n.delete('q'); return n; }, { replace: true });
    }, 250);
    return () => clearTimeout(t);
  }, [search, q, setParams]);

  const url = new URLSearchParams(FILTER_PARAM[filter] ?? '');
  if (q) url.set('q', q);
  if (tag) url.set('tag', tag);
  const listUrl = `/api/recipes?${url}`;
  const { data: recipes, loading, error, reload } = useApi(listUrl, { keepPrevious: true });
  const { data: tags, reload: reloadTags } = useApi('/api/recipes/tags');

  // An Undo from the recipe page (after we navigated here) brings the recipe back into this list.
  useEffect(() => {
    const again = () => { reload(); reloadTags(); };
    window.addEventListener('hl:recipes-changed', again);
    return () => window.removeEventListener('hl:recipes-changed', again);
  }, [reload, reloadTags]);

  const toast = useToast();
  const [selecting, setSelecting] = useState(false);
  const [picked, setPicked] = useState(() => new Set());
  const [printMode, setPrintMode] = useState('index');
  const [cards, setCards] = useState(null); // { key: the list url they were chosen from, list }
  const cardsRequest = useRef(0);
  const listReady = Boolean(recipes) && !loading;
  const printer = usePrint({
    ready: printMode === 'cards' ? listReady && cards?.key === listUrl : listReady,
    failed: Boolean(error),
    viewKey: listUrl,
  });
  // Once nothing is printing or queued (printed, cancelled, or dropped because the list changed),
  // go back to the index, so Ctrl+P never prints cards picked from an older list.
  const printIdle = !printer.active && !printer.preparing;
  useEffect(() => {
    if (!printIdle) return;
    cardsRequest.current += 1;
    setPrintMode('index');
    setCards(null);
  }, [printIdle]);
  // Only cards in the list as it stands count, so a search that hides a ticked card leaves it off.
  // While a new list loads, the old one is still on screen, so card printing waits for it.
  const ticked = (recipes ?? []).filter(r => picked.has(r.id));
  const chosen = listReady ? ticked : [];
  const toggle = id => setPicked(p => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const selectAll = () => setPicked(new Set((recipes ?? []).map(r => r.id)));
  const printIndex = () => { setPrintMode('index'); setCards(null); printer.print(); };
  async function printCards() {
    if (!listReady || !chosen.length) return;
    const ticket = ++cardsRequest.current;
    const key = listUrl;
    setPrintMode('cards');
    setCards(null);
    printer.print();
    try {
      const list = await Promise.all(chosen.map(r => api.get(`/api/recipes/${r.id}`)));
      if (ticket === cardsRequest.current) setCards({ key, list });
    } catch (err) {
      if (ticket !== cardsRequest.current) return;
      printer.cancel();
      toast?.show({ message: err.message });
    }
  }
  const preparingCards = printer.preparing && printMode === 'cards';
  const indexNotes = [q && `matching "${q}"`, FILTER_NOTE[filter], tag && `tagged ${tag}`].filter(Boolean);

  const setParam = (key, value) => setParams(p => { const n = new URLSearchParams(p); if (value) n.set(key, value); else n.delete(key); return n; });
  const filtered = Boolean(q || tag || filter);
  const clear = () => { setSearch(''); setParams({}); };
  const newButton = <Button as={Link} to="/recipes/new" icon={Plus}>New recipe</Button>;
  const note = recipes && !filtered && recipes.length ? `${recipes.length} card${recipes.length === 1 ? '' : 's'} in the box` : null;

  return (
    <>
      <PageHeader title="Recipe Box" note={note} actions={<>
        {recipes?.length > 0 && <PrintButton onClick={printIndex} busy={printer.preparing && printMode === 'index'} disabled={!listReady}>Print index</PrintButton>}
        {recipes?.length > 0 && <Button variant="ghost" icon={SquareCheck} aria-pressed={selecting} onClick={() => setSelecting(v => !v)}>Print cards</Button>}
        <Button as={Link} to="/can-make" variant="secondary">What can I make?</Button>{newButton}
      </>} />
      {selecting && (
        <section className="select-bar card card-butter no-print" aria-label="Choose cards to print">
          <p className="hand select-hint">Tick the cards to print, one to a page.</p>
          <span className="select-count">{ticked.length} selected</span>
          <Button size="sm" variant="secondary" onClick={selectAll}>Select all</Button>
          <Button size="sm" variant="ghost" onClick={() => setPicked(new Set())} disabled={!picked.size}>Clear</Button>
          <PrintButton size="sm" variant="primary" onClick={printCards} busy={preparingCards} disabled={!chosen.length}>
            Print {ticked.length === 1 ? '1 card' : `${ticked.length} cards`}
          </PrintButton>
          <Button size="sm" variant="ghost" onClick={() => setSelecting(false)}>Done</Button>
          <span className="visually-hidden" role="status">{preparingCards ? 'Preparing the cards for printing' : ''}</span>
        </section>
      )}
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
          {recipes?.map(r => (selecting ? (
            <div key={r.id} className={`recipe-pick-wrap${picked.has(r.id) ? ' is-picked' : ''}`}>
              <RecipeCard recipe={r} />
              <label className="recipe-pick">
                <input type="checkbox" checked={picked.has(r.id)} onChange={() => toggle(r.id)} aria-label={`Select ${r.title} for printing`} />
              </label>
            </div>
          ) : <RecipeCard key={r.id} recipe={r} />))}
        </div>
      )}

      {printMode === 'index' && (
        <PrintGate printer={printer} what="Recipe index">{() => <RecipeIndexPrint recipes={recipes} filters={indexNotes} />}</PrintGate>
      )}
      {printMode === 'cards' && (
        <PrintGate printer={printer} what="Recipe cards" bare className="is-cards">{() => cards.list.map(c => (
            <section className="print-page" key={c.id}>
              <PrintHeader what="Recipe card" />
              <RecipePrint recipe={c} />
              <PrintFooter />
            </section>
          ))}</PrintGate>
      )}
    </>
  );
}
