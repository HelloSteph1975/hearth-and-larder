import { useState } from 'react';
import { Check, CalendarPlus, Pencil, X, Plus, Sprout } from 'lucide-react';
import { Button } from './Button.jsx';
import { Badge } from './Badge.jsx';
import { RhythmForm, HarvestDialog } from './RhythmForm.jsx';
import { AddToPlanDialog } from './AddToPlanDialog.jsx';
import { useToast } from './ToastProvider.jsx';
import { useDeleteWithUndo } from './useDeleteWithUndo.jsx';
import { useApi } from '../lib/useApi.js';
import { todayISO, prettyDate } from '../lib/dates.js';
import { cadenceText, statusOf, groupOf, GROUPS, markMade } from '../lib/rhythm.js';

export function RhythmRow({ rhythm, today, onMade, onPlan, onEdit, onDelete }) {
  const [tone, text] = statusOf(rhythm, today);
  return (
    <li className={`rhythm-row is-${rhythm.state}`}>
      <div className="rhythm-main">
        <strong>{rhythm.name}</strong>
        <span className="muted">
          {cadenceText(rhythm)}
          {rhythm.crops ? ` · from ${rhythm.crops}` : ''}
          {rhythm.last_made ? ` · last made ${prettyDate(rhythm.last_made)}` : ''}
        </span>
      </div>
      {tone ? <Badge tone={tone}>{text}</Badge> : <span className="muted rhythm-quiet">{text}</span>}
      <span className="rhythm-tools">
        <Button size="sm" variant="secondary" icon={Check} onClick={() => onMade(rhythm)} aria-label={`Made ${rhythm.name} today`}>Made it</Button>
        {onPlan && <Button size="sm" variant="ghost" icon={CalendarPlus} onClick={() => onPlan(rhythm)} aria-label={`Plan ${rhythm.name}`}>Plan it</Button>}
        {onEdit && <button className="icon-btn" aria-label={`Edit ${rhythm.name}`} onClick={() => onEdit(rhythm)}><Pencil size={16} /></button>}
        {onDelete && <button className="icon-btn" aria-label={`Delete ${rhythm.name}`} onClick={() => onDelete(rhythm)}><X size={16} /></button>}
      </span>
    </li>
  );
}

// The staples made on a repeat or in their season, grouped by how often.
export function RhythmList() {
  const today = todayISO();
  const { data, error, reload } = useApi(`/api/rhythms?today=${today}`);
  const { data: recipes } = useApi('/api/recipes');
  const toast = useToast();
  const del = useDeleteWithUndo();
  const [editing, setEditing] = useState(null); // a staple, or 'new'
  const [planning, setPlanning] = useState(null);
  const [harvesting, setHarvesting] = useState(false);

  if (error) return <div className="card error-card"><p className="error-note">{error.message}</p><Button variant="secondary" onClick={reload}>Try again</Button></div>;
  if (!data) return <span className="skeleton skeleton-card" aria-busy="true" aria-label="Loading" />;

  const due = data.filter(r => ['harvest', 'overdue', 'due'].includes(r.state)).length;
  const made = r => markMade(r, today, { toast, onChange: reload });
  const remove = r => del({ url: `/api/rhythms/${r.id}`, label: r.name, onChange: reload });

  return (
    <section className="rhythm" aria-labelledby="h-rhythm">
      <div className="rhythm-head">
        <div>
          <h2 id="h-rhythm">Your rhythm</h2>
          <p className="muted">{due ? `${due} ${due === 1 ? 'staple wants' : 'staples want'} making now.` : 'Nothing is due right now.'} Tap Made it when you make one, and it works out when it is due again.</p>
        </div>
        <span className="rhythm-actions">
          <Button variant="secondary" icon={Sprout} onClick={() => setHarvesting(true)}>Log a harvest</Button>
          <Button icon={Plus} onClick={() => setEditing('new')}>Add a staple</Button>
        </span>
      </div>
      {GROUPS.map(g => {
        const rows = data.filter(r => groupOf(r) === g);
        if (!rows.length) return null;
        return (
          <div key={g} className="card rhythm-group">
            <h3>{g}</h3>
            <ul className="rhythm-list">
              {rows.map(r => <RhythmRow key={r.id} rhythm={r} today={today} onMade={made} onPlan={setPlanning} onEdit={setEditing} onDelete={remove} />)}
            </ul>
          </div>
        );
      })}
      <RhythmForm open={Boolean(editing)} rhythm={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} />
      <HarvestDialog open={harvesting} today={today} onClose={() => setHarvesting(false)} onSaved={() => { setHarvesting(false); reload(); }} />
      <AddToPlanDialog open={Boolean(planning)} recipes={recipes}
        initial={planning ? { date: today, slot: 'batch', note: planning.name, rhythm_id: planning.id } : null}
        onClose={() => setPlanning(null)} onSaved={() => setPlanning(null)} />
    </section>
  );
}
