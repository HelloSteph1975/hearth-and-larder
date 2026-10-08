import { Link } from 'react-router-dom';
import { Star } from 'lucide-react';
import { Badge } from './Badge.jsx';
import { formatQty } from '../lib/format.js';
import { daysBetween, todayISO, relativeDays } from '../lib/dates.js';
import { StoreIcon } from './StoreIcon.jsx';
import { SOURCE_LABELS } from '../lib/options.js';
import { useSettings } from './SettingsProvider.jsx';

export function UseByBadge({ useBy }) {
  const { settings } = useSettings();
  if (!useBy) return null;
  const d = daysBetween(todayISO(), useBy);
  if (d < 0) return <Badge tone="tomato">past use-by</Badge>;
  if (d <= (Number(settings.use_soon_days) || 14)) return <Badge tone="honey">use {relativeDays(d)}</Badge>;
  return null;
}

export function ItemCard({ item, storeIcon }) {
  return (
    <Link to={`/item/${item.id}`} className="card item-card">
      <div className="item-photo">
        {item.photo ? <img src={`/photos/${item.photo}`} alt="" loading="lazy" /> : <StoreIcon icon={storeIcon} size={56} />}
      </div>
      <div className="item-body">
        <h3>{item.name} {item.favorite ? <Star size={14} className="fav" aria-label="Favorite" /> : null}</h3>
        <p className="item-qty"><strong>{formatQty(item.quantity)}</strong> {item.unit}{item.mixed_units ? ' + more' : ''}
          {item.location_name && <span className="muted"> · {item.location_name}</span>}</p>
        <div className="badges">
          {item.is_low && <Badge tone="tomato">running low</Badge>}
          <UseByBadge useBy={item.next_use_by} />
          {(item.sources ?? []).map(s => <Badge key={s} tone="garden">{SOURCE_LABELS[s] ?? s}</Badge>)}
        </div>
      </div>
    </Link>
  );
}
