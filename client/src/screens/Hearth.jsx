import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShoppingBasket, BookOpen, Settings as Cog, Plus } from 'lucide-react';
import { PageHeader } from '../components/PageHeader.jsx';
import { Card } from '../components/Card.jsx';
import { Button } from '../components/Button.jsx';
import { Badge } from '../components/Badge.jsx';
import { JarArt } from '../components/Illustrations.jsx';
import { SLOTS, SLOT_LABEL } from '../components/AddToPlanDialog.jsx';
import { useStores } from '../components/StoresProvider.jsx';
import { useToast } from '../components/ToastProvider.jsx';
import { ItemForm } from './ItemForm.jsx';
import { useApi } from '../lib/useApi.js';
import { api } from '../lib/api.js';
import { todayISO, prettyDate, relativeDays } from '../lib/dates.js';
import { formatQty } from '../lib/format.js';

export function greeting(hour, name) {
  const part = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
  return `Good ${part}${name ? `, ${name}` : ''}`;
}

const plural = (n, one, many) => (n === 1 ? one : many);

function Stat({ value, label }) {
  return (
    <div className="stat-tile">
      <span className="stat-value">{value}</span>
      <span className="stat-label">{label}</span>
    </div>
  );
}

function Welcome({ onAddJar, ready }) {
  return (
    <Card as="section" className="welcome-card stitched" aria-labelledby="h-welcome">
      <div className="welcome-art"><JarArt size={132} /></div>
      <h2 id="h-welcome">Welcome to Hearth &amp; Larder</h2>
      <p className="hand">Let&apos;s fill the shelves.</p>
      <p className="muted welcome-body">Keep track of every jar, sack and bundle, write down the recipes you love, and plan the week&apos;s meals. Start with whatever is closest to hand.</p>
      <div className="welcome-actions">
        <Button icon={Plus} disabled={!ready} onClick={onAddJar}>Add your first jar</Button>
        <Button as={Link} to="/recipes/new" variant="secondary" icon={BookOpen}>Write a recipe</Button>
        <Button as={Link} to="/settings" variant="ghost" icon={Cog}>Visit Settings</Button>
      </div>
    </Card>
  );
}

function UseSoonCard({ rows }) {
  return (
    <Card as="section" className="home-card" aria-labelledby="h-soon">
      <h2 id="h-soon">Use soon</h2>
      {rows.length === 0 ? <p className="hand">Nothing close to its use-by. Lovely.</p> : (
        <ul className="home-list">
          {rows.map(b => (
            <li key={b.batch_id}>
              <div className="home-main">
                <Link to={`/item/${b.item_id}`}>{b.item_name}</Link>
                <span className="muted">{b.store_name} · {formatQty(b.quantity)} {b.unit}</span>
              </div>
              {b.days_left < 0 ? <Badge tone="tomato">past use-by</Badge> : <Badge tone="honey">use {relativeDays(b.days_left)}</Badge>}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function LowCard({ rows }) {
  const toast = useToast();
  const [added, setAdded] = useState({});
  async function add(item) {
    try {
      await api.post('/api/shopping', { name: item.name, unit: item.unit });
      setAdded(a => ({ ...a, [item.id]: true }));
      toast.show({ message: `Added ${item.name} to the shopping list` });
    } catch (err) { toast.show({ message: err.message, duration: 6000 }); }
  }
  return (
    <Card as="section" className="home-card" aria-labelledby="h-low">
      <h2 id="h-low">Running low</h2>
      {rows.length === 0 ? <p className="hand">Every shelf is well stocked.</p> : (
        <ul className="home-list">
          {rows.map(i => (
            <li key={i.id}>
              <div className="home-main">
                <Link to={`/item/${i.id}`}>{i.name}</Link>
                <span className="muted">{formatQty(i.quantity ?? 0)} {i.unit} left</span>
              </div>
              <Button size="sm" variant="secondary" icon={ShoppingBasket} disabled={Boolean(added[i.id])} aria-label={`Add ${i.name} to list`} onClick={() => add(i)}>
                {added[i.id] ? 'Added' : 'Add to list'}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function TodayCard({ rows }) {
  return (
    <Card as="section" className="home-card" aria-labelledby="h-today">
      <h2 id="h-today">Today&apos;s table</h2>
      {rows.length === 0 ? <p className="hand">Nothing planned. <Link to="/planner">Plan a meal</Link></p> : (
        <ul className="home-list">
          {SLOTS.flatMap(slot => rows.filter(r => r.slot === slot)).map(e => (
            <li key={e.id}>
              <div className="home-main">
                <span className="slot-name">{SLOT_LABEL[e.slot]}</span>
                {e.recipe_id ? <Link to={`/recipes/${e.recipe_id}`}>{e.recipe_title}</Link> : <span>{e.note}</span>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function CanMakeCard({ recipes }) {
  return (
    <Card as="section" className="home-card" aria-labelledby="h-can">
      <h2 id="h-can">What can I make?</h2>
      {recipes.length === 0 ? <p className="hand">Stock the shelves and I will find you something.</p> : (
        <ul className="chip-list">
          {recipes.slice(0, 4).map(r => <li key={r.id}><Link className="chip" to={`/recipes/${r.id}`}>{r.title}</Link></li>)}
        </ul>
      )}
      <p className="home-more"><Link to="/can-make">See all</Link></p>
    </Card>
  );
}

function CookedCard({ rows }) {
  return (
    <Card as="section" className="home-card" aria-labelledby="h-cooked">
      <h2 id="h-cooked">Recently cooked</h2>
      {rows.length === 0 ? <p className="hand">Nothing cooked yet. The stove is waiting.</p> : (
        <ul className="home-list">
          {rows.slice(0, 5).map(c => (
            <li key={c.id}>
              <div className="home-main"><Link to={`/recipes/${c.recipe_id}`}>{c.title}</Link></div>
              <span className="muted">{prettyDate(c.cooked_on)}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export function Hearth() {
  const { data, error, reload } = useApi(`/api/home?today=${todayISO()}`);
  const { stores } = useStores();
  const navigate = useNavigate();
  const [adding, setAdding] = useState(false);

  if (error) return <div className="card error-card"><p className="error-note">{error.message}</p><Button variant="secondary" onClick={reload}>Try again</Button></div>;
  if (!data) return <div className="grid-cards" aria-busy="true" aria-label="Loading">{[0, 1, 2].map(i => <span key={i} className="skeleton skeleton-card" />)}</div>;

  const { settings, use_soon, running_low, today, can_make, recently_cooked, counts } = data;
  const firstRun = counts.items === 0 && counts.recipes === 0;
  const n = use_soon.length;
  const note = firstRun ? 'the kettle is on and the shelves are empty'
    : n ? `${n} ${plural(n, 'jar wants', 'jars want')} using this week` : 'the shelves are in good shape';

  return (
    <>
      <PageHeader title={greeting(new Date().getHours(), settings.household_name)} note={note} />
      {firstRun ? <Welcome ready={stores.length > 0} onAddJar={() => setAdding(true)} /> : (
        <>
          <div className="stat-row">
            <Stat value={counts.items} label={plural(counts.items, 'thing on the shelves', 'things on the shelves')} />
            <Stat value={counts.batches} label={plural(counts.batches, 'batch put by', 'batches put by')} />
            <Stat value={counts.recipes} label={plural(counts.recipes, 'recipe in the box', 'recipes in the box')} />
            <Stat value={today.length} label={plural(today.length, 'meal planned today', 'meals planned today')} />
          </div>
          <div className="home-grid">
            <UseSoonCard rows={use_soon} />
            <LowCard rows={running_low} />
            <TodayCard rows={today} />
            <CanMakeCard recipes={can_make} />
            <CookedCard rows={recently_cooked} />
          </div>
        </>
      )}
      <ItemForm open={adding} storeId={stores[0]?.id} onClose={() => setAdding(false)}
        onSaved={saved => { setAdding(false); reload(); if (saved?.id) navigate(`/item/${saved.id}`); }} />
    </>
  );
}
