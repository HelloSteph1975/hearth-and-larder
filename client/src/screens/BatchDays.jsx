import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CalendarPlus, CalendarDays } from 'lucide-react';
import { PageHeader } from '../components/PageHeader.jsx';
import { Button } from '../components/Button.jsx';
import { Badge } from '../components/Badge.jsx';
import { PlaceBatchDialog } from '../components/PlaceBatchDialog.jsx';
import { useSettings } from '../components/SettingsProvider.jsx';
import { useApi } from '../lib/useApi.js';
import { todayISO, weekStart, prettyDate, addDays } from '../lib/dates.js';
import { KIND_LABEL, readyTime } from '../lib/batch.js';

function status(plan) {
  if (plan.done) return <Badge tone="garden">Done {prettyDate(plan.done_on)}</Badge>;
  const next = plan.runs.at(-1);
  if (next) return <Badge tone="honey">Planned from {prettyDate(next.first_date)}</Badge>;
  return null;
}

function WeekCard({ plan, onPlace }) {
  return (
    <article className={`card batch-week${plan.done ? ' is-done' : ''}`} aria-labelledby={`bw-${plan.id}`}>
      <header className="batch-week-top">
        <div>
          <h3 id={`bw-${plan.id}`}>Week {plan.week_no}</h3>
          <p className="hand batch-week-title">{plan.title}</p>
        </div>
        {status(plan)}
      </header>
      <dl className="batch-days">
        {plan.days.map(d => (
          <div key={d.id} className="batch-day">
            <dt>Day {d.day_no}</dt>
            <dd>
              <strong>{KIND_LABEL[d.kind]}.</strong> {d.task}
              {d.ready_min != null && <> <Badge tone="honey" className="ready-tag">Ready in {readyTime(d)}</Badge></>}
            </dd>
          </div>
        ))}
        {plan.cook && <div className="batch-day"><dt>Cook</dt><dd className="muted">{plan.cook}</dd></div>}
      </dl>
      <Button size="sm" variant={plan.done ? 'secondary' : 'primary'} icon={CalendarPlus} onClick={() => onPlace(plan)} aria-label={`Put Week ${plan.week_no} on the planner`}>
        {plan.runs.length ? 'Plan it again' : 'Put on the planner'}
      </Button>
    </article>
  );
}

export function BatchDays() {
  const { data, error, reload } = useApi('/api/batch-plans');
  const { settings } = useSettings();
  const navigate = useNavigate();
  const [placing, setPlacing] = useState(null);

  if (error) return <div className="card error-card"><p className="error-note">{error.message}</p><Button variant="secondary" onClick={reload}>Try again</Button></div>;
  if (!data) return <div className="grid-cards" aria-busy="true" aria-label="Loading">{[0, 1, 2].map(i => <span key={i} className="skeleton skeleton-card" />)}</div>;

  const done = data.filter(p => p.done).length;
  const next = data.find(p => !p.done && !p.runs.length);
  const months = [...Map.groupBy(data, p => p.month_title)].map(([title, weeks]) => ({ title, note: weeks[0].month_note, weeks }));
  // New batch weeks usually start next week.
  const start = weekStart(addDays(todayISO(), 7), settings.week_start);

  return (
    <>
      <PageHeader title="Batch Days" note={`${done} of ${data.length} weeks done${next ? `. Next up: Week ${next.week_no}` : ''}`}
        actions={<Button as={Link} to="/planner" variant="ghost" icon={CalendarDays}>Meal Planner</Button>} />
      <p className="batch-intro">Three short sessions a week: a big make, one jar to start, and one staple to refill. Pick a week, pick three days, and the tasks land on your planner. Tick each one off there as you go.</p>
      {months.map(m => (
        <section key={m.title} className="batch-month" aria-labelledby={`bm-${m.weeks[0].id}`}>
          <h2 id={`bm-${m.weeks[0].id}`}>{m.title}</h2>
          {m.note && <p className="muted">{m.note}</p>}
          <div className="batch-weeks">{m.weeks.map(p => <WeekCard key={p.id} plan={p} onPlace={setPlacing} />)}</div>
        </section>
      ))}
      <PlaceBatchDialog open={Boolean(placing)} plan={placing} start={start} onClose={() => setPlacing(null)}
        onSaved={from => { setPlacing(null); navigate(`/planner?week=${from}`); }} />
    </>
  );
}

