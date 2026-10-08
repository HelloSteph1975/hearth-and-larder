import { JarArt, PotatoArt, WheatArt, RecipeBoxArt, BasketArt } from './Illustrations.jsx';

const ART = { jar: JarArt, potato: PotatoArt, wheat: WheatArt, recipeBox: RecipeBoxArt, basket: BasketArt };

export function EmptyState({ art = 'jar', title, body, action }) {
  const Art = ART[art] ?? JarArt;
  return (
    <section className="empty-state">
      <div className="empty-inner stitched">
        <div className="empty-art"><Art size={112} /></div>
        {title && <h2>{title}</h2>}
        {body && <p className="empty-body">{body}</p>}
        {action && <div className="empty-action">{action}</div>}
      </div>
    </section>
  );
}
