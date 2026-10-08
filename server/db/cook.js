// What a cook took from each batch. Deleting the cook log puts it back; restoring takes it again.

export function addDeduction(db, { cook_log_id, batch_id, amount, was_used_up }) {
  db.prepare('INSERT INTO cook_deductions (cook_log_id, batch_id, amount, was_used_up) VALUES (?, ?, ?, ?)')
    .run(cook_log_id, batch_id, amount, was_used_up ? 1 : 0);
}

export const deductionsFor = (db, cookLogId) => db.prepare('SELECT * FROM cook_deductions WHERE cook_log_id = ? ORDER BY id').all(cookLogId);

export function updateDeduction(db, id, { amount, was_used_up }) {
  db.prepare('UPDATE cook_deductions SET amount = ?, was_used_up = ? WHERE id = ?').run(amount, was_used_up ? 1 : 0, id);
}

// Batches are read and written whether or not they are soft-deleted, so an undone batch delete still adds up.
export const anyBatch = (db, id) => db.prepare('SELECT * FROM batches WHERE id = ?').get(id) ?? null;

export function setBatchStock(db, id, quantity, used_up_at) {
  db.prepare("UPDATE batches SET quantity = ?, used_up_at = ?, updated_at = datetime('now') WHERE id = ?").run(quantity, used_up_at, id);
}
