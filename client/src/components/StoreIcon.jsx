import { Apple, Snowflake, Egg, Leaf, Package, Fish, Milk } from 'lucide-react';
import { JarArt, PotatoArt, WheatArt } from './Illustrations.jsx';

const ICONS = {
  jar: JarArt, potato: PotatoArt, wheat: WheatArt,
  apple: Apple, snowflake: Snowflake, egg: Egg, leaf: Leaf, box: Package, fish: Fish, milk: Milk,
};

export const STORE_ICONS = Object.keys(ICONS);

export function StoreIcon({ icon, size = 22, className = '' }) {
  const Icon = ICONS[icon] ?? Package;
  return (
    <span className={`store-icon ${className}`.trim()} aria-hidden="true">
      <Icon size={size} />
    </span>
  );
}
