const bind = v => (typeof v === 'boolean' ? Number(v) : v);

export function createRepo(db, table, columns, { orderBy = 'id' } = {}) {
  const pickKeys = data => columns.filter(k => data[k] !== undefined);

  function get(id, { includeDeleted = false } = {}) {
    const sql = `SELECT * FROM ${table} WHERE id = ?${includeDeleted ? '' : ' AND deleted_at IS NULL'}`;
    return db.prepare(sql).get(id) ?? null;
  }

  return {
    table,
    get,
    list(where = {}) {
      const keys = Object.keys(where).filter(k => columns.includes(k) && where[k] !== undefined && where[k] !== '');
      const sql = `SELECT * FROM ${table} WHERE deleted_at IS NULL${keys.map(k => ` AND ${k} = ?`).join('')} ORDER BY ${orderBy}`;
      return db.prepare(sql).all(...keys.map(k => bind(where[k])));
    },
    create(data) {
      const keys = pickKeys(data);
      const sql = keys.length
        ? `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`
        : `INSERT INTO ${table} DEFAULT VALUES`;
      const r = db.prepare(sql).run(...keys.map(k => bind(data[k])));
      return get(Number(r.lastInsertRowid));
    },
    update(id, data) {
      const keys = pickKeys(data);
      if (keys.length) {
        db.prepare(`UPDATE ${table} SET ${keys.map(k => `${k} = ?`).join(', ')}, updated_at = datetime('now') WHERE id = ? AND deleted_at IS NULL`)
          .run(...keys.map(k => bind(data[k])), id);
      }
      return get(id);
    },
    remove(id, stamp = new Date().toISOString()) {
      return db.prepare(`UPDATE ${table} SET deleted_at = ? WHERE id = ? AND deleted_at IS NULL`).run(stamp, id).changes > 0;
    },
    restore(id) {
      return db.prepare(`UPDATE ${table} SET deleted_at = NULL WHERE id = ? AND deleted_at IS NOT NULL`).run(id).changes > 0;
    },
  };
}
