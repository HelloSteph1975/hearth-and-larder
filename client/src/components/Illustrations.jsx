// Original illustrations drawn for Hearth & Larder. Outlines use currentColor;
// fills use the palette from theme/tokens.css (hex here so they also work in
// contexts where CSS variables don't reach, like the favicon).
import { useId } from 'react';

const C = {
  cream: '#FFFDF6', linen: '#FBF1D9', tomato: '#C44A3A', tomatoDark: '#A63B2D', tomatoSoft: '#F7DCD5',
  garden: '#6B8F4E', gardenSoft: '#E3EDD6', honey: '#F0D78C', honeyLight: '#F6E3A1',
  wood: '#D9A066', woodDark: '#B97E48', potato: '#DDB273',
};

function Svg({ size, label, children }) {
  return (
    <svg className="art" viewBox="0 0 64 64" width={size} height={size} fill="none" stroke="currentColor"
      strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
      role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      {children}
    </svg>
  );
}

function useGingham() {
  const id = `g${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const def = (
    <defs>
      <pattern id={id} width="6" height="6" patternUnits="userSpaceOnUse">
        <rect width="6" height="6" fill={C.cream} />
        <rect width="3" height="6" fill={C.tomato} opacity=".5" />
        <rect width="6" height="3" fill={C.tomato} opacity=".5" />
      </pattern>
    </defs>
  );
  return [`url(#${id})`, def];
}

export function JarArt({ size = 64, label }) {
  const [check, defs] = useGingham();
  return (
    <Svg size={size} label={label}>
      {defs}
      <path d="M13 35h38v15c0 5-3 8-8 8H21c-5 0-8-3-8-8z" fill={C.tomato} stroke="none" />
      <path d="M21 21c-6 2-8 6-8 12v17c0 5 3 8 8 8h22c5 0 8-3 8-8V33c0-6-2-10-8-12z" fill={C.honeyLight} fillOpacity=".55" />
      <path d="M17 30v6" stroke={C.cream} strokeWidth="2.6" />
      <rect x="20" y="16" width="24" height="5" rx="1.5" fill={C.linen} />
      <rect x="17" y="7" width="30" height="10" rx="3" fill={check} />
      <rect x="22" y="37" width="20" height="14" rx="2.5" fill={C.cream} />
      <path d="M32 47.5c-3.6-2.3-5.4-4.2-5.4-6.3a2.7 2.7 0 0 1 5.4-.8 2.7 2.7 0 0 1 5.4.8c0 2.1-1.8 4-5.4 6.3z"
        fill={C.tomato} stroke={C.tomatoDark} strokeWidth="1.2" />
    </Svg>
  );
}

export function PotatoArt({ size = 64, label }) {
  return (
    <Svg size={size} label={label}>
      <path d="M12 37c-1-10 6-17 15-18 6-.6 9-3.6 15-2.6 8 1.4 12 8 10.6 16-.8 5 1.4 9-2 14-4.6 6.4-13 7.6-21 7.4C19 53.6 13 47 12 37z"
        fill={C.potato} />
      <path d="M20 46c3 2.6 7.6 3.6 12 2.6" strokeWidth="1.6" opacity=".45" />
      <circle cx="24" cy="32" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="37" cy="42" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="44" cy="28" r="1.4" fill="currentColor" stroke="none" />
      <path d="M40 17c0-4 1.4-7.4 4.4-9.6" stroke={C.garden} strokeWidth="2.4" />
      <path d="M44.4 7.4c3-1.6 6.4-1 8 1.4-3.2 2.4-6.6 1.8-8-1.4z" fill={C.garden} stroke={C.garden} strokeWidth="1.4" />
      <path d="M41.6 12c-3-2.4-6.6-2.4-8.6-.2 2.4 2.4 6.2 2.4 8.6.2z" fill={C.gardenSoft} stroke={C.garden} strokeWidth="1.4" />
    </Svg>
  );
}

const grain = (x, y, r) => <ellipse key={`${x}-${y}`} cx={x} cy={y} rx="2.4" ry="4.6" transform={`rotate(${r} ${x} ${y})`} />;

export function WheatArt({ size = 64, label }) {
  return (
    <Svg size={size} label={label}>
      <path d="M32 58V14M27 58l5-12q-5-12-12-28M37 58l-5-12q5-12 12-28" />
      <g fill={C.honey} strokeWidth="1.6">
        {[grain(32, 9, 0), grain(29, 16, -28), grain(35, 16, 28), grain(29, 23, -28), grain(35, 23, 28)]}
        {[grain(18.6, 13, -24), grain(16.4, 20, -52), grain(22.6, 19.6, 4), grain(19.4, 26.4, -52), grain(25, 26, 4)]}
        {[grain(45.4, 13, 24), grain(47.6, 20, 52), grain(41.4, 19.6, -4), grain(44.6, 26.4, 52), grain(39, 26, -4)]}
      </g>
      <path d="M32 45c-4-4.4-10-4.4-10 0s6 4.4 10 0zM32 45c4-4.4 10-4.4 10 0s-6 4.4-10 0z" fill={C.tomato} stroke={C.tomatoDark} strokeWidth="1.6" />
      <path d="M30.6 46.4l-3.6 7M33.4 46.4l3.6 7" stroke={C.tomato} strokeWidth="2.4" />
      <circle cx="32" cy="45" r="2.2" fill={C.tomatoDark} stroke="none" />
    </Svg>
  );
}

export function RecipeBoxArt({ size = 64, label }) {
  const [check, defs] = useGingham();
  return (
    <Svg size={size} label={label}>
      {defs}
      <path d="M9 31l4-7h38l4 7z" fill={C.woodDark} />
      <rect x="13" y="12" width="28" height="22" rx="2" fill={C.cream} transform="rotate(-7 27 23)" />
      <path d="M17 19.5l15-1.8M17.6 24.4l11-1.4" stroke="#7A6455" strokeWidth="1.6" transform="rotate(-1 24 22)" />
      <rect x="38" y="11" width="10" height="7" rx="1.6" fill={check} transform="rotate(6 43 14)" />
      <rect x="22" y="16" width="28" height="18" rx="2" fill={C.linen} transform="rotate(6 36 25)" />
      <rect x="8" y="30" width="48" height="26" rx="3.5" fill={C.wood} />
      <path d="M13 38h10M40 49h10M15 51h6" strokeWidth="1.6" opacity=".45" />
      <rect x="25" y="37" width="14" height="9" rx="2" fill={C.cream} />
      <path d="M29 41.5h6" strokeWidth="1.6" />
    </Svg>
  );
}

export function BasketArt({ size = 64, label }) {
  const [check, defs] = useGingham();
  return (
    <Svg size={size} label={label}>
      {defs}
      <path d="M15 31C15 12 49 12 49 31" strokeWidth="3" />
      <path d="M17 32c2-7 8-10.4 15-10.4S45 25 47 32z" fill={check} />
      <path d="M12 34h40l-4.6 20.4c-.5 2.2-2.2 3.6-4.4 3.6H21c-2.2 0-3.9-1.4-4.4-3.6z" fill={C.wood} />
      <path d="M14.4 42h35.2M16 49.6h32M23 35l1.6 22M32 35v22M41 35l-1.6 22" strokeWidth="1.6" opacity=".45" />
      <rect x="9" y="30" width="46" height="6" rx="3" fill={C.woodDark} />
      <path d="M44 33l7.4 9.6-9.4-2.4z" fill={check} />
    </Svg>
  );
}
