import { Link } from 'react-router-dom';
import { Heart, Clock } from 'lucide-react';
import { RecipeBoxArt } from './Illustrations.jsx';
import { formatMinutes } from '../lib/format.js';

export function StockLine({ stock }) {
  if (!stock || !stock.total) return null;
  return stock.can_make
    ? <p className="stock-line is-ready">You have everything</p>
    : <p className="stock-line">You have {stock.have} of {stock.total}</p>;
}

export function RecipeCard({ recipe }) {
  const tags = (recipe.tags ?? []).slice(0, 3);
  return (
    <Link to={`/recipes/${recipe.id}`} className="card recipe-tile">
      <div className="recipe-tile-photo">
        {recipe.photo ? <img src={`/photos/${recipe.photo}`} alt="" loading="lazy" /> : <RecipeBoxArt size={72} />}
        {recipe.favorite ? <span className="recipe-tile-heart" role="img" aria-label="Favorite"><Heart size={16} aria-hidden="true" /></span> : null}
      </div>
      <div className="recipe-tile-body">
        <h3>{recipe.title}</h3>
        {recipe.total_minutes ? <p className="recipe-tile-time muted"><Clock size={14} aria-hidden="true" /> {formatMinutes(recipe.total_minutes)}</p> : null}
        {tags.length > 0 && <div className="badges">{tags.map(t => <span key={t} className="tag">{t}</span>)}</div>}
        <StockLine stock={recipe.stock} />
      </div>
    </Link>
  );
}
