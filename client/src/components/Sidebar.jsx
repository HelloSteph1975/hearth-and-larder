import { NavLink } from 'react-router-dom';
import { House, BookOpen, ChefHat, CalendarDays, ShoppingBasket, Settings } from 'lucide-react';
import { JarArt } from './Illustrations.jsx';
import { StoreIcon } from './StoreIcon.jsx';
import { useStores } from './StoresProvider.jsx';
import { useApi } from '../lib/useApi.js';

const linkClass = ({ isActive }) => `nav-link${isActive ? ' is-active' : ''}`;

function NavItem({ to, icon, end, color, children }) {
  return (
    <li>
      <NavLink to={to} end={end} className={linkClass} style={color ? { '--store-color': color } : undefined}>
        <span className="nav-icon" aria-hidden="true">{icon}</span>
        <span className="nav-label">{children}</span>
        {color && <span className="store-dot" aria-hidden="true" />}
      </NavLink>
    </li>
  );
}

export function Brand() {
  return (
    <NavLink to="/" className="brand" aria-label="Hearth & Larder, home">
      <span className="brand-mark"><JarArt size={44} /></span>
      <span className="brand-text">
        <span className="brand-name">Hearth &amp; Larder</span>
        <span className="brand-tag hand">keep the shelves happy</span>
      </span>
    </NavLink>
  );
}

export function Sidebar({ id, open = false }) {
  const { stores } = useStores();
  const { data: health } = useApi('/api/health');
  return (
    <aside id={id} className={`sidebar gingham${open ? ' is-open' : ''}`} aria-label="Main">
      {health?.demo && <div className="demo-ribbon" role="note">Demo</div>}
      <div className="sidebar-inner">
        <Brand />
        <nav className="nav" aria-label="Main navigation">
          <ul className="nav-list">
            <NavItem to="/" end icon={<House size={20} />}>Hearth</NavItem>
          </ul>
          <p className="nav-heading">Stores</p>
          <ul className="nav-list">
            {stores.map(s => (
              <NavItem key={s.id} to={`/store/${s.id}`} color={s.color} icon={<StoreIcon icon={s.icon} size={22} />}>{s.name}</NavItem>
            ))}
          </ul>
          <p className="nav-heading">Cooking</p>
          <ul className="nav-list">
            <NavItem to="/recipes" icon={<BookOpen size={20} />}>Recipe Box</NavItem>
            <NavItem to="/can-make" icon={<ChefHat size={20} />}>What can I make?</NavItem>
            <NavItem to="/planner" icon={<CalendarDays size={20} />}>Meal Planner</NavItem>
            <NavItem to="/shopping" icon={<ShoppingBasket size={20} />}>Shopping List</NavItem>
          </ul>
          <ul className="nav-list nav-foot">
            <NavItem to="/settings" icon={<Settings size={20} />}>Settings</NavItem>
          </ul>
        </nav>
      </div>
    </aside>
  );
}
