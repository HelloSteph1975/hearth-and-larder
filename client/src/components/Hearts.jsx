import { Heart } from 'lucide-react';

export function HeartsDisplay({ value }) {
  if (!value) return null;
  return (
    <span className="hearts" role="img" aria-label={`Rated ${value} out of 5`}>
      {[1, 2, 3, 4, 5].map(n => <Heart key={n} size={16} className={n <= value ? 'on' : ''} aria-hidden="true" />)}
    </span>
  );
}

// Radio group of hearts: click, or use the arrow keys, Home and End.
export function HeartRating({ value, onChange, label = 'Rating' }) {
  const v = Number(value) || 0;
  const key = e => {
    const next = { ArrowRight: v + 1, ArrowUp: v + 1, ArrowLeft: v - 1, ArrowDown: v - 1, Home: 0, End: 5 }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    const to = Math.min(5, Math.max(0, next));
    const group = e.currentTarget;
    onChange(to);
    requestAnimationFrame(() => group.querySelectorAll('button')[Math.max(to, 1) - 1]?.focus());
  };
  return (
    <div className="heart-rating" role="radiogroup" aria-label={label} onKeyDown={key}>
      {[1, 2, 3, 4, 5].map(n => (
        <button key={n} type="button" role="radio" aria-checked={v === n} aria-label={`${n} heart${n === 1 ? '' : 's'}`}
          tabIndex={v === n || (v === 0 && n === 1) ? 0 : -1}
          className={n <= v ? 'on' : ''} onClick={() => onChange(v === n ? 0 : n)}>
          <Heart size={24} aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}
