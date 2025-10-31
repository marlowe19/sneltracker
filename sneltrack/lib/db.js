import { sql } from "@vercel/postgres";

// Ensure schema exists on first use
export async function ensureSchema() {
  await sql`
    CREATE TABLE IF NOT EXISTS time_entries (
      id serial PRIMARY KEY,
      user_name text NOT NULL,
      start_time timestamptz NOT NULL,
      end_time timestamptz
    );
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_time_entries_user_start 
    ON time_entries(user_name, start_time DESC);
  `;
}

export { sql };

export async function getActiveEntry(userName) {
  const { rows } = await sql`
    SELECT * FROM time_entries 
    WHERE user_name=${userName} AND end_time IS NULL 
    ORDER BY start_time DESC 
    LIMIT 1
  `;
  return rows[0] || null;
}

export async function startEntry(userName) {
  const existing = await getActiveEntry(userName);
  if (existing) return existing;
  const { rows } = await sql`
    INSERT INTO time_entries (user_name, start_time)
    VALUES (${userName}, NOW())
    RETURNING *
  `;
  return rows[0];
}

export async function stopEntry(userName) {
  const active = await getActiveEntry(userName);
  if (!active) return null;
  const { rows } = await sql`
    UPDATE time_entries SET end_time = NOW() 
    WHERE id=${active.id}
    RETURNING *
  `;
  return rows[0];
}

export async function getWeekEntries(userName, weekStartIso, weekEndIso) {
  const { rows } = await sql`
    SELECT * FROM time_entries
    WHERE user_name=${userName}
      AND start_time < ${weekEndIso}::timestamptz
      AND COALESCE(end_time, NOW()) >= ${weekStartIso}::timestamptz
    ORDER BY start_time ASC
  `;
  return rows;
}
