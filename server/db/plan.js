export function planEntries(db, from, to) {
  return db.prepare(`SELECT m.*, r.title AS recipe_title, r.servings AS recipe_servings,
      (SELECT p.filename FROM photos p WHERE p.owner_type = 'recipe' AND p.owner_id = r.id AND p.deleted_at IS NULL ORDER BY p.sort_order, p.id LIMIT 1) AS recipe_photo,
      d.kind AS batch_kind, d.day_no AS batch_day_no, d.ready_min, d.ready_max, d.ready_unit, bp.week_no AS batch_week
    FROM meal_plan m LEFT JOIN recipes r ON r.id = m.recipe_id
      LEFT JOIN batch_days d ON d.id = m.batch_day_id LEFT JOIN batch_plans bp ON bp.id = d.plan_id
    WHERE m.deleted_at IS NULL AND m.date BETWEEN ? AND ? AND (m.recipe_id IS NULL OR r.deleted_at IS NULL)
    ORDER BY m.date, CASE m.slot WHEN 'breakfast' THEN 0 WHEN 'lunch' THEN 1 WHEN 'supper' THEN 2 WHEN 'snack' THEN 3 ELSE 4 END, m.sort_order, m.id`).all(from, to);
}

// Planned batch tasks that take time to be ready (a jar, a crock).
export function readyEntries(db) {
  return db.prepare(`SELECT m.id, m.date, m.note, m.done_on, d.kind AS batch_kind, d.ready_min, d.ready_max, d.ready_unit, bp.week_no AS batch_week
    FROM meal_plan m JOIN batch_days d ON d.id = m.batch_day_id JOIN batch_plans bp ON bp.id = d.plan_id
    WHERE m.deleted_at IS NULL AND d.ready_min IS NOT NULL ORDER BY m.date, m.id`).all();
}
