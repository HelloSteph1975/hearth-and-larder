import { useEffect, useMemo, useRef, useState } from 'react';
import { useBlocker, useNavigate, useParams, Link } from 'react-router-dom';
import { ArrowDown, ArrowUp, ClipboardPaste, Heading, Plus, X } from 'lucide-react';
import { PageHeader } from '../components/PageHeader.jsx';
import { Button } from '../components/Button.jsx';
import { Field, TextInput, NumberInput, TextArea, Checkbox } from '../components/Field.jsx';
import { FormAlert } from '../components/BatchFields.jsx';
import { HeartRating } from '../components/Hearts.jsx';
import { useToast } from '../components/ToastProvider.jsx';
import { useConfirm } from '../components/ConfirmProvider.jsx';
import { useSettings } from '../components/SettingsProvider.jsx';
import { useApi } from '../lib/useApi.js';
import { api } from '../lib/api.js';
import { UNITS } from '../lib/options.js';
import { parseIngredientLine } from '../lib/ingredients.js';
import { NotFound } from './NotFound.jsx';

const NUTRIENTS = [
  ['calories', 'Calories'], ['protein_g', 'Protein (g)'], ['carbs_g', 'Carbs (g)'], ['fat_g', 'Fat (g)'],
  ['fiber_g', 'Fiber (g)'], ['sugar_g', 'Sugar (g)'], ['sodium_mg', 'Sodium (mg)'],
];
const BASIC_KEYS = ['title', 'description', 'servings', 'prep_minutes', 'cook_minutes', 'source_credit', 'rating', 'notes', ...NUTRIENTS.map(n => n[0])];
const PASTE_PLACEHOLDER = '2 cups flour\n1 tsp salt\n½ cup butter, cold';

let nextKey = 1;
const uid = () => nextKey++;
const blankIng = (over = {}) => ({ key: uid(), kind: 'ing', quantity: '', unit: '', name: '', prep_note: '', optional: false, is_staple: false, ...over });
const blankStep = (text = '') => ({ key: uid(), text });

function fromRecipe(r, defaultServings = 4) {
  const base = {
    title: r?.title ?? '', description: r?.description ?? '', servings: r?.servings ?? defaultServings, prep_minutes: r?.prep_minutes ?? '', cook_minutes: r?.cook_minutes ?? '',
    source_credit: r?.source_credit ?? '', is_family_recipe: Boolean(r?.is_family_recipe), favorite: Boolean(r?.favorite), rating: r?.rating ?? 0, notes: r?.notes ?? '',
    ...Object.fromEntries(NUTRIENTS.map(([k]) => [k, r?.[k] ?? ''])),
  };
  // A section heading is its own row in the editor; on save it becomes the `section` of every ingredient below it.
  const entries = [];
  let section = null;
  for (const i of r?.ingredients ?? []) {
    const next = i.section || null;
    // A blank heading marks "back to no section", so an unsectioned row after a sectioned one stays unsectioned on save.
    if (next !== section && (next || section)) entries.push({ key: uid(), kind: 'section', text: next ?? '' });
    section = next;
    entries.push(blankIng({
      quantity: i.quantity ?? '', unit: i.unit ?? '', name: i.name, prep_note: i.prep_note ?? '', optional: Boolean(i.optional), is_staple: Boolean(i.is_staple),
    }));
  }
  const steps = (r?.steps ?? []).map(s => blankStep(s.text));
  return { base, tags: r?.tags ?? [], entries: entries.length ? entries : [blankIng()], steps: steps.length ? steps : [blankStep()] };
}

// Plain data (no editor keys) so "did anything change?" is a simple comparison.
const snapshot = s => JSON.stringify({ ...s, entries: s.entries.map(({ key, ...e }) => e), steps: s.steps.map(x => x.text) });

function move(list, i, d) {
  const j = i + d;
  if (j < 0 || j >= list.length) return list;
  const next = [...list];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

export function RecipeEditor() {
  const { id } = useParams();
  const { data, error } = useApi(id ? `/api/recipes/${id}` : null);
  const { settings, loading: settingsLoading } = useSettings();
  if (id && error) return error.status === 404 ? <NotFound /> : <p className="card error-card">{error.message}</p>;
  if ((id && !data) || (!id && settingsLoading)) return <div className="skeleton skeleton-card" aria-busy="true" />;
  return <EditorForm key={id ?? 'new'} recipe={data} defaultServings={Number(settings.default_servings) || 4} />;
}

function EditorForm({ recipe, defaultServings }) {
  const editing = Boolean(recipe);
  const nav = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const initial = useMemo(() => fromRecipe(recipe, defaultServings), [recipe, defaultServings]);
  const [base, setBase] = useState(initial.base);
  const [tags, setTags] = useState(initial.tags);
  const [tagText, setTagText] = useState('');
  const [entries, setEntries] = useState(initial.entries);
  const [steps, setSteps] = useState(initial.steps);
  const [pasteText, setPasteText] = useState('');
  const [errors, setErrors] = useState({});
  const [errKeys, setErrKeys] = useState({}); // payload index -> entry key, as of the last save attempt
  const [saving, setSaving] = useState(false);
  const initialSnap = useRef(snapshot(initial));
  const { data: knownTags } = useApi('/api/recipes/tags');
  const { data: items } = useApi('/api/items');
  const itemNames = useMemo(() => [...new Set((items ?? []).map(i => i.name))].sort((a, b) => a.localeCompare(b)), [items]);

  const dirty = snapshot({ base, tags, entries, steps }) !== initialSnap.current || tagText.trim() !== '' || pasteText.trim() !== '';
  const set = k => e => setBase(b => ({ ...b, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  function commitTag(text = tagText) {
    const parts = text.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
    if (parts.length) setTags(ts => [...new Set([...ts, ...parts])]);
    setTagText('');
  }
  const onTagKey = e => {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); commitTag(); }
    else if (e.key === 'Backspace' && !tagText) setTags(ts => ts.slice(0, -1));
  };

  // Enter inside a field should not save the whole recipe; Ctrl or Cmd+Enter does.
  const onFormKey = e => {
    if (e.key !== 'Enter' || e.defaultPrevented) return;
    if (e.ctrlKey || e.metaKey) { e.preventDefault(); e.currentTarget.requestSubmit(); }
    else if (e.target.tagName === 'INPUT' && e.target.type !== 'checkbox') e.preventDefault();
  };

  useEffect(() => {
    if (!dirty) return undefined;
    const warn = e => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  // In-app navigation (sidebar, back button) asks first too. Saving and Cancel set leaving so they pass straight through.
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  const leaving = useRef(false);
  const blocker = useBlocker(({ currentLocation, nextLocation }) =>
    dirtyRef.current && !leaving.current && currentLocation.pathname !== nextLocation.pathname);
  const blockerRef = useRef(blocker);
  blockerRef.current = blocker;
  useEffect(() => {
    if (blocker.state !== 'blocked') return undefined;
    let live = true;
    confirm({ title: 'Throw away your changes?', body: 'What you typed here has not been saved.', confirmLabel: 'Discard changes', danger: true })
      .then(ok => {
        if (!live) return;
        if (ok) { leaving.current = true; blockerRef.current.proceed?.(); } else blockerRef.current.reset?.();
      });
    return () => { live = false; };
  }, [blocker.state, confirm]);

  const setEntry = (i, patch) => setEntries(es => es.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const addPasted = () => {
    const rows = pasteText.split('\n').map(l => l.trim()).filter(Boolean).map(parseIngredientLine).filter(p => p.name)
      .map(p => blankIng({ ...p, quantity: p.quantity ?? '' }));
    if (!rows.length) return;
    setEntries(es => {
      const lone = es.length === 1 && es[0].kind === 'ing' && !es[0].name && es[0].quantity === ''; // replace the lone blank row
      return [...(lone ? [] : es), ...rows];
    });
    setPasteText('');
    toast.show({ message: `Added ${rows.length} ingredient${rows.length === 1 ? '' : 's'}. Check the amounts below.` });
  };

  async function cancel() {
    if (dirty && !(await confirm({ title: 'Throw away your changes?', body: 'What you typed here has not been saved.', confirmLabel: 'Discard changes', danger: true }))) return;
    leaving.current = true;
    nav(editing ? `/recipes/${recipe.id}` : '/recipes');
  }

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    let section = null;
    const ingredients = [];
    const keys = {};
    for (const en of entries) {
      if (en.kind === 'section') { section = en.text.trim() || null; continue; }
      if (!en.name.trim() && en.quantity === '' && !en.prep_note) continue; // untouched blank row
      keys[ingredients.length] = en.key; // the server numbers errors by submitted row, so remember which entry that was
      ingredients.push({
        section, quantity: en.quantity === '' ? null : Number(en.quantity), unit: en.unit.trim() || null, name: en.name.trim(),
        prep_note: en.prep_note.trim() || null, optional: en.optional, is_staple: en.is_staple,
      });
    }
    setErrKeys(keys);
    const pendingTags = tagText.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
    const body = {
      ...base,
      title: base.title.trim(),
      rating: base.rating || null,
      tags: [...new Set([...tags, ...pendingTags])],
      ingredients,
      steps: steps.map(s => s.text.trim()).filter(Boolean),
    };
    try {
      const saved = editing ? await api.put(`/api/recipes/${recipe.id}`, body) : await api.post('/api/recipes', body);
      toast.show({ message: editing ? `Saved ${saved.title}` : `Added ${saved.title} to the recipe box` });
      initialSnap.current = snapshot({ base, tags, entries, steps });
      leaving.current = true;
      nav(`/recipes/${saved.id}`, { replace: true });
    } catch (err) {
      setErrors(err.details ?? {});
      toast.show({ message: err.message });
    } finally {
      setSaving(false);
    }
  }

  // Map each ingredient entry to its index among ingredients only, the way the server numbers its errors.
  let ingCount = 0;
  const ingIndex = entries.map(en => (en.kind === 'ing' ? ingCount++ : -1));
  const shown = [...BASIC_KEYS, ...Object.keys(errors).filter(k => /^ingredients\.\d+\./.test(k))];
  const ingErrors = n => Object.entries(errors).filter(([k]) => k.startsWith(`ingredients.${n}.`)).map(([, v]) => v);

  const suggestions = (knownTags ?? []).filter(t => !tags.includes(t));

  return (
    <form className="editor" onSubmit={save} onKeyDown={onFormKey} noValidate>
      <PageHeader title={editing ? `Edit ${recipe.title}` : 'New recipe'} note={editing ? 'Fix it up, then tuck it back in the box' : 'Write it like it is going on an index card'} />

      <fieldset className="stitched-set editor-set">
        <legend className="hand">The basics</legend>
        <div className="form-grid">
          <Field label="Title" className="span-2" error={errors.title}><TextInput value={base.title} onChange={set('title')} required autoFocus={!editing} placeholder="Grandma June's buttermilk biscuits" /></Field>
          <Field label="Description" className="span-2" error={errors.description}><TextArea rows={2} value={base.description} onChange={set('description')} placeholder="A line or two about why you love it" /></Field>
          <Field label="Servings" error={errors.servings}><NumberInput value={base.servings} onChange={set('servings')} min="0.25" /></Field>
          <Field label="Source" hint="Who it came from, or &quot;my own&quot;" error={errors.source_credit}><TextInput value={base.source_credit} onChange={set('source_credit')} placeholder="Grandma June" /></Field>
          <Field label="Prep minutes" error={errors.prep_minutes}><NumberInput value={base.prep_minutes} onChange={set('prep_minutes')} min="0" step="1" /></Field>
          <Field label="Cook minutes" error={errors.cook_minutes}><NumberInput value={base.cook_minutes} onChange={set('cook_minutes')} min="0" step="1" /></Field>
          <div className="checks span-2">
            <Checkbox label="Family recipe" checked={base.is_family_recipe} onChange={set('is_family_recipe')} />
            <Checkbox label="Favorite" checked={base.favorite} onChange={set('favorite')} />
            <div className="rating-field">
              <span className="rating-label">Rating</span>
              <HeartRating value={base.rating} onChange={v => setBase(b => ({ ...b, rating: v }))} label="Rating" />
            </div>
          </div>
        </div>
      </fieldset>

      <fieldset className="stitched-set editor-set">
        <legend className="hand">Tags</legend>
        <div className="tag-input">
          {tags.map(t => (
            <span key={t} className="tag tag-chip">{t}
              <button type="button" aria-label={`Remove tag ${t}`} onClick={() => setTags(ts => ts.filter(x => x !== t))}><X size={13} aria-hidden="true" /></button>
            </span>
          ))}
          <input className="tag-field" list="tag-suggestions" aria-label="Add a tag" placeholder={tags.length ? '' : 'breakfast, canning, holiday…'}
            value={tagText} onChange={e => setTagText(e.target.value)} onKeyDown={onTagKey} onBlur={() => commitTag()} />
          <datalist id="tag-suggestions">{suggestions.map(t => <option key={t} value={t} />)}</datalist>
        </div>
        <p className="field-hint editor-hint">Type a tag, then press Enter or a comma.</p>
      </fieldset>

      <fieldset className="stitched-set editor-set">
        <legend className="hand">Ingredients</legend>
        <datalist id="unit-options">{UNITS.map(u => <option key={u} value={u} />)}</datalist>
        <datalist id="item-names">{itemNames.map(n => <option key={n} value={n} />)}</datalist>
        <ol className="editor-rows">
          {entries.map((en, i) => {
            const n = ingIndex[i];
            const pn = Object.keys(errKeys).find(k => errKeys[k] === en.key); // the server's row number for this entry
            const errs = pn !== undefined ? ingErrors(pn) : [];
            const what = en.kind === 'section' ? `section ${en.text.trim() || 'heading'}` : `ingredient ${n + 1}`;
            const tools = (
              <span className="row-tools">
                <button type="button" className="icon-btn" aria-label={`Move ${what} up`} disabled={i === 0} onClick={() => setEntries(es => move(es, i, -1))}><ArrowUp size={16} /></button>
                <button type="button" className="icon-btn" aria-label={`Move ${what} down`} disabled={i === entries.length - 1} onClick={() => setEntries(es => move(es, i, 1))}><ArrowDown size={16} /></button>
                <button type="button" className="icon-btn" aria-label={`Remove ${what}`} onClick={() => setEntries(es => (es.length > 1 ? es.filter((_, j) => j !== i) : [blankIng()]))}><X size={16} /></button>
              </span>
            );
            if (en.kind === 'section') {
              return (
                <li key={en.key} className="editor-row is-section" role="group" aria-label="Section heading">
                  <input className="input hand-input" aria-label="Section heading" placeholder="For the filling" value={en.text} onChange={e => setEntry(i, { text: e.target.value })} />
                  {tools}
                </li>
              );
            }
            return (
              <li key={en.key} className={`editor-row${errs.length ? ' has-error' : ''}`} role="group" aria-label={`Ingredient ${n + 1}`}>
                <input className="input" type="number" step="any" min="0" inputMode="decimal" aria-label={`Quantity for ingredient ${n + 1}`} placeholder="Qty"
                  value={en.quantity} onChange={e => setEntry(i, { quantity: e.target.value })} aria-invalid={Boolean(errors[`ingredients.${pn}.quantity`])} />
                <input className="input" list="unit-options" aria-label={`Unit for ingredient ${n + 1}`} placeholder="Unit"
                  value={en.unit} onChange={e => setEntry(i, { unit: e.target.value })} />
                <input className="input row-name" list="item-names" aria-label={`Name of ingredient ${n + 1}`} placeholder="Ingredient"
                  value={en.name} onChange={e => setEntry(i, { name: e.target.value })} aria-invalid={Boolean(errors[`ingredients.${pn}.name`])} />
                <input className="input" aria-label={`Prep note for ingredient ${n + 1}`} placeholder="Prep note (sifted…)"
                  value={en.prep_note} onChange={e => setEntry(i, { prep_note: e.target.value })} />
                <span className="row-checks">
                  <Checkbox label="Optional" checked={en.optional} onChange={e => setEntry(i, { optional: e.target.checked })} />
                  <Checkbox label="Staple" checked={en.is_staple} onChange={e => setEntry(i, { is_staple: e.target.checked })} />
                </span>
                {tools}
                {errs.length > 0 && <small className="field-error row-error" role="alert">{errs.join(' · ')}</small>}
              </li>
            );
          })}
        </ol>
        <div className="editor-add">
          <Button variant="secondary" size="sm" icon={Plus} onClick={() => setEntries(es => [...es, blankIng()])}>Add ingredient</Button>
          <Button variant="secondary" size="sm" icon={Heading} onClick={() => setEntries(es => [...es, { key: uid(), kind: 'section', text: '' }])}>Add section heading</Button>
        </div>
        <div className="paste-box">
          <Field label="Paste a list" hint="One ingredient per line, like 1 1/2 cups flour, sifted">
            <TextArea rows={4} value={pasteText} onChange={e => setPasteText(e.target.value)} placeholder={PASTE_PLACEHOLDER} />
          </Field>
          <Button variant="secondary" size="sm" icon={ClipboardPaste} onClick={addPasted} disabled={!pasteText.trim()}>Turn into ingredients</Button>
        </div>
      </fieldset>

      <fieldset className="stitched-set editor-set">
        <legend className="hand">Method</legend>
        <ol className="editor-rows steps-edit">
          {steps.map((st, i) => (
            <li key={st.key} className="editor-row is-step" role="group" aria-label={`Step ${i + 1}`}>
              <textarea className="input" rows={2} aria-label={`Step ${i + 1} text`} placeholder="What happens next?" value={st.text}
                onChange={e => setSteps(ss => ss.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))} />
              <span className="row-tools">
                <button type="button" className="icon-btn" aria-label={`Move step ${i + 1} up`} disabled={i === 0} onClick={() => setSteps(ss => move(ss, i, -1))}><ArrowUp size={16} /></button>
                <button type="button" className="icon-btn" aria-label={`Move step ${i + 1} down`} disabled={i === steps.length - 1} onClick={() => setSteps(ss => move(ss, i, 1))}><ArrowDown size={16} /></button>
                <button type="button" className="icon-btn" aria-label={`Remove step ${i + 1}`} onClick={() => setSteps(ss => (ss.length > 1 ? ss.filter((_, j) => j !== i) : [blankStep()]))}><X size={16} /></button>
              </span>
            </li>
          ))}
        </ol>
        <div className="editor-add"><Button variant="secondary" size="sm" icon={Plus} onClick={() => setSteps(ss => [...ss, blankStep()])}>Add step</Button></div>
      </fieldset>

      <fieldset className="stitched-set editor-set">
        <legend className="hand">Nutrition per serving</legend>
        <div className="nutrition-fields">
          {NUTRIENTS.map(([k, label]) => (
            <Field key={k} label={label} error={errors[k]}><NumberInput value={base[k]} onChange={set(k)} min="0" /></Field>
          ))}
        </div>
      </fieldset>

      <fieldset className="stitched-set editor-set">
        <legend className="hand">Notes</legend>
        <Field label="Notes to yourself" error={errors.notes}><TextArea value={base.notes} onChange={set('notes')} placeholder="Double it for the church supper…" /></Field>
      </fieldset>

      <div className="form-grid"><FormAlert errors={errors} shown={shown} /></div>
      <div className="editor-foot">
        <p className="hand">{editing ? <>Photos live on the <Link to={`/recipes/${recipe.id}`}>recipe page</Link>.</> : 'After you save, you can add photos on the recipe page.'}</p>
        <div className="editor-foot-actions">
          <Button variant="ghost" onClick={cancel}>Cancel</Button>
          <Button type="submit" disabled={saving}>{editing ? 'Save recipe' : 'Add to the recipe box'}</Button>
        </div>
      </div>
    </form>
  );
}
