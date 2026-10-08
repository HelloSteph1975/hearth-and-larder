import { useMemo, useState } from 'react';
import { DndContext, pointerWithin, rectIntersection, PointerSensor, KeyboardSensor, useSensor, useSensors, useDraggable, useDroppable, DragOverlay } from '@dnd-kit/core';
import { ChevronLeft, ChevronRight, Plus, X, GripVertical, ShoppingBasket, Pencil } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useApi } from '../lib/useApi.js';
import { api } from '../lib/api.js';
import { todayISO, weekStart, weekDays, addDays, prettyDate } from '../lib/dates.js';
import { PageHeader } from '../components/PageHeader.jsx';
import { Button } from '../components/Button.jsx';
import { AddToPlanDialog, SLOTS, SLOT_LABEL } from '../components/AddToPlanDialog.jsx';
import { useDeleteWithUndo } from '../components/useDeleteWithUndo.jsx';
import { useToast } from '../components/ToastProvider.jsx';
import { PrintButton, PrintGate } from '../components/Print.jsx';
import { PlanPrint } from '../components/PrintViews.jsx';
import { usePrint } from '../lib/usePrint.js';

export { SLOTS };

export function planDropTarget(id) {
  const [date, slot] = String(id).split('|');
  return slot && SLOTS.includes(slot) ? { date, slot } : null;
}

// Applies a finished drag. Returns 'created', 'moved', or null when nothing should change.
export async function applyDrop({ active, over }, client = api) {
  const target = over && planDropTarget(over.id);
  const data = active?.data?.current;
  if (!target || !data) return null;
  if (data.recipe) {
    await client.post('/api/plan', { ...target, recipe_id: data.recipe.id });
    return 'created';
  }
  if (!data.entry || (data.entry.date === target.date && data.entry.slot === target.slot)) return null;
  await client.patch(`/api/plan/${data.entry.id}`, target);
  return 'moved';
}

const describe = data => data?.recipe?.title ?? data?.entry?.recipe_title ?? data?.entry?.note ?? 'item';
function describeTarget(id) {
  const t = id != null && planDropTarget(id);
  return t ? `${prettyDate(t.date)}, ${SLOT_LABEL[t.slot].toLowerCase()}` : null;
}
export const announcements = {
  onDragStart: ({ active }) => `Picked up ${describe(active.data.current)}.`,
  onDragOver: ({ active, over }) => {
    const where = over && describeTarget(over.id);
    return where ? `${describe(active.data.current)} is over ${where}.` : `${describe(active.data.current)} is not over a day.`;
  },
  onDragEnd: ({ active, over }) => {
    const where = over && describeTarget(over.id);
    return where ? `Dropped ${describe(active.data.current)} on ${where}.` : `Dropped ${describe(active.data.current)}. It was not placed on a day.`;
  },
  onDragCancel: ({ active }) => `Moving ${describe(active.data.current)} was cancelled.`,
};
const screenReaderInstructions = {
  draggable: 'To pick up, press space or enter. Use the arrow keys to move over a day, then press space or enter to drop, or escape to cancel. Or use the plus button in a day to add a meal.',
};

function DrawerRecipe({ recipe }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `recipe-${recipe.id}`, data: { recipe } });
  return (
    <li className="drawer-li">
      <div ref={setNodeRef} className={`drawer-recipe ${isDragging ? 'is-dragging' : ''}`} {...listeners} {...attributes} aria-label={`Drag ${recipe.title} onto a day`}>
        <GripVertical size={14} aria-hidden="true" /> <span>{recipe.title}</span>
      </div>
    </li>
  );
}

function Entry({ entry, onRemove, onEdit }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `entry-${entry.id}`, data: { entry } });
  const label = entry.recipe_title ?? entry.note;
  return (
    <div ref={setNodeRef} className={`plan-entry ${entry.recipe_id ? '' : 'is-note'} ${isDragging ? 'is-dragging' : ''}`}>
      <span className="plan-entry-text">
        {entry.recipe_id ? <Link to={`/recipes/${entry.recipe_id}`}>{entry.recipe_title}</Link>
          : <button type="button" className="link-btn hand" onClick={() => onEdit(entry)}>{entry.note}</button>}
        {entry.servings ? <small className="muted"> x{entry.servings}</small> : null}
      </span>
      <span className="entry-tools">
        <span className="drag-handle" {...listeners} {...attributes} aria-label={`Move ${label}`}><GripVertical size={14} /></span>
        <button className="icon-btn" aria-label={`Edit ${label}`} onClick={() => onEdit(entry)}><Pencil size={14} /></button>
        <button className="icon-btn" aria-label={`Remove ${label} from plan`} onClick={() => onRemove(entry)}><X size={14} /></button>
      </span>
    </div>
  );
}

function Slot({ date, slot, entries, onAdd, onRemove, onEdit }) {
  const { setNodeRef, isOver } = useDroppable({ id: `${date}|${slot}` });
  return (
    <div ref={setNodeRef} role="cell" className={`plan-slot ${isOver ? 'is-over' : ''} ${date === todayISO() ? 'is-today' : ''}`}>
      {entries.map(e => <Entry key={e.id} entry={e} onRemove={onRemove} onEdit={onEdit} />)}
      <button className="slot-add" aria-label={`Add ${slot} on ${prettyDate(date)}`} onClick={() => onAdd(date, slot)}><Plus size={14} aria-hidden="true" /></button>
    </div>
  );
}

// The cell under the pointer wins; keyboard drags have no pointer, so fall back to overlap.
const hits = args => { const within = pointerWithin(args); return within.length ? within : rectIntersection(args); };

export function Planner() {
  const settingsState = useApi('/api/settings');
  const settings = settingsState.data;
  const [start, setStart] = useState(null);
  const weekStartDay = settings?.week_start ?? 'monday';
  const from = start ?? weekStart(todayISO(), weekStartDay);
  const days = weekDays(from);
  const planUrl = settings ? `/api/plan?from=${from}&to=${days[6]}` : null;
  const { data: entries, error: planError, loading: planLoading, reload } = useApi(planUrl, { keepPrevious: true });
  const { data: recipes, error: recipesError, reload: reloadRecipes } = useApi('/api/recipes');
  const { error: settingsError, reload: reloadSettings } = settingsState;
  const loadError = settingsError ?? planError ?? recipesError;
  const [filter, setFilter] = useState('');
  const [adding, setAdding] = useState(null);
  const [editingEntry, setEditingEntry] = useState(null);
  const [dragging, setDragging] = useState(null);
  const del = useDeleteWithUndo();
  const toast = useToast();
  // The week on paper must be the week whose dates head the columns.
  const printer = usePrint({ ready: Boolean(planUrl && entries) && !planLoading, failed: Boolean(loadError), viewKey: planUrl ?? '' });
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor));

  const grid = useMemo(() => {
    const g = {};
    for (const e of entries ?? []) (g[`${e.date}|${e.slot}`] ??= []).push(e);
    return g;
  }, [entries]);

  async function onDragEnd(e) {
    setDragging(null);
    try {
      if (await applyDrop(e)) reload();
    } catch (err) { toast.show({ message: err.message, duration: 6000 }); }
  }
  const tryAgain = () => { reloadSettings(); reload(); reloadRecipes(); };

  const remove = e => del({ url: `/api/plan/${e.id}`, label: e.recipe_title ?? e.note, onChange: reload, body: 'It comes off the plan. You can undo this for a few seconds.' });
  const shown = (recipes ?? []).filter(r => r.title.toLowerCase().includes(filter.trim().toLowerCase()));
  const today = todayISO();

  return (
    <DndContext sensors={sensors} collisionDetection={hits} accessibility={{ announcements, screenReaderInstructions }} onDragStart={({ active }) => setDragging(active.data.current)} onDragEnd={onDragEnd} onDragCancel={() => setDragging(null)}>
      <PageHeader title="Meal Planner" note={`Week of ${prettyDate(from)}`}
        actions={<>
          <Button variant="ghost" icon={ChevronLeft} onClick={() => setStart(addDays(from, -7))} aria-label="Previous week" />
          <Button variant="ghost" onClick={() => setStart(null)}>This week</Button>
          <Button variant="ghost" icon={ChevronRight} onClick={() => setStart(addDays(from, 7))} aria-label="Next week" />
          <PrintButton onClick={printer.print} busy={printer.preparing} disabled={!entries} />
          <Button as={Link} to={`/shopping?from=${from}&to=${days[6]}`} icon={ShoppingBasket}>Shopping list for this week</Button>
        </>} />
      {loadError ? (
        <div className="card error-card"><p className="error-note" role="alert">{loadError.message}</p><Button variant="secondary" onClick={tryAgain}>Try again</Button></div>
      ) : (
      <div className="planner">
        <aside className="drawer card" aria-label="Recipe box">
          <h2>Recipe box</h2>
          <input className="input" type="search" placeholder="Find a recipe" aria-label="Find a recipe" value={filter} onChange={e => setFilter(e.target.value)} />
          <p className="hand drawer-hint">drag onto a day ~</p>
          {recipes && !recipes.length
            ? <p className="muted">No recipes yet. <Link to="/recipes/new">Write the first one.</Link></p>
            : <ul>{shown.map(r => <DrawerRecipe key={r.id} recipe={r} />)}</ul>}
          {recipes?.length > 0 && !shown.length && <p className="muted">Nothing matches that.</p>}
        </aside>
        <div className="week-wrap">
          <div className="week card" role="table" aria-label="Week plan">
            <div className="week-head" role="row">
              <span role="columnheader" />
              {days.map(d => {
                const [wd, num, mon] = prettyDate(d).split(' ');
                return (
                  <span key={d} role="columnheader" aria-label={prettyDate(d)} className={`day-head ${d === today ? 'is-today' : ''}`}>
                    <small>{wd}</small><strong>{num}</strong><small>{mon}</small>
                  </span>
                );
              })}
            </div>
            {SLOTS.map(slot => (
              <div className="week-row" role="row" key={slot}>
                <span className="slot-label hand" role="rowheader">{SLOT_LABEL[slot]}</span>
                {days.map(d => <Slot key={d} date={d} slot={slot} entries={grid[`${d}|${slot}`] ?? []} onAdd={(date, s) => setAdding({ date, slot: s })} onRemove={remove} onEdit={setEditingEntry} />)}
              </div>
            ))}
          </div>
          {entries && !entries.length && <p className="hand empty-week">A clean week. Drag a recipe onto a day, or tap a + to begin.</p>}
        </div>
      </div>
      )}
      <PrintGate printer={printer} what="Meal plan" className="is-landscape">{() => <PlanPrint days={days} entries={entries} />}</PrintGate>
      <DragOverlay>{dragging && <div className="plan-entry is-overlay">{dragging.recipe?.title ?? dragging.entry?.recipe_title ?? dragging.entry?.note}</div>}</DragOverlay>
      <AddToPlanDialog open={Boolean(adding)} initial={adding} recipes={recipes} onClose={() => setAdding(null)} onSaved={() => { setAdding(null); reload(); }} />
      <AddToPlanDialog open={Boolean(editingEntry)} entry={editingEntry} recipes={recipes} onClose={() => setEditingEntry(null)} onSaved={() => { setEditingEntry(null); reload(); }} />
    </DndContext>
  );
}
