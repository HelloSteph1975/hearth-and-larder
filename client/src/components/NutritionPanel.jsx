import { Link } from 'react-router-dom';

export const NUTRIENTS = [
  ['calories', 'Calories', ''], ['protein_g', 'Protein', 'g'], ['carbs_g', 'Carbs', 'g'], ['fat_g', 'Fat', 'g'],
  ['fiber_g', 'Fiber', 'g'], ['sugar_g', 'Sugar', 'g'], ['sodium_mg', 'Sodium', 'mg'],
];

// Nutrients are stored per serving, so the scaler never changes them; the total column is value x servings.
export function scaleNutrient(value, servings = 1) {
  if (value == null || value === '') return null;
  return Math.round(Number(value) * Number(servings) * 10) / 10;
}
const show = (v, unit) => (v == null ? '–' : `${Math.round(v * 10) / 10}${unit}`);

export function NutritionPanel({ recipe, servings }) {
  const present = NUTRIENTS.filter(([k]) => recipe[k] != null);
  if (!present.length) {
    return (
      <section className="nutrition nutrition-empty">
        <h2>Nutrition</h2>
        <p className="hand">No nutrition noted yet. <Link to={`/recipes/${recipe.id}/edit`}>Add nutrition in Edit</Link></p>
      </section>
    );
  }
  return (
    <section className="nutrition">
      <h2>Nutrition</h2>
      <table className="nutrition-table">
        <caption className="visually-hidden">Nutrition per serving and for {servings} servings</caption>
        <thead><tr><th scope="col">Nutrient</th><th scope="col">Per serving</th><th scope="col">All {Math.round(servings * 100) / 100}</th></tr></thead>
        <tbody>
          {present.map(([k, label, unit]) => (
            <tr key={k}><th scope="row">{label}</th><td>{show(recipe[k], unit)}</td><td>{show(scaleNutrient(recipe[k], servings), unit)}</td></tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
