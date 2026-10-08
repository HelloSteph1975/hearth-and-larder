export function planEntries(db, from, to) {
  return db.prepare(`SELECT m.*, r.title AS recipe_title, r.servings AS recipe_servings,
      (SELECT p.filename FROM photos p WHERE p.owner_type = 'recipe' AND p.owner_id = r.id AND p.deleted_at IS NULL ORDER BY p.sort_order, p.id LIMIT 1) AS recipe_photo
    FROM meal_plan m LEFT JOIN recipes r ON r.id = m.recipe_id
    WHERE m.deleted_at IS NULL AND m.date BETWEEN ? AND ? AND (m.recipe_id IS NULL OR r.deleted_at IS NULL)
    ORDER BY m.date, CASE m.slot WHEN 'breakfast' THEN 0 WHEN 'lunch' THEN 1 WHEN 'supper' THEN 2 ELSE 3 END, m.sort_order, m.id`).all(from, to);
}
