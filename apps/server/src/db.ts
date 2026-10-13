import pg from "pg";
import { config } from "./config";

export const pool = new pg.Pool({ connectionString: config.databaseUrl, max: 5, idleTimeoutMillis: 30_000 });
pool.on("error", (e) => console.error("postgres pool error", e));

export async function tx<T>(fn: (c: pg.PoolClient) => Promise<T>): Promise<T> {
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    const r = await fn(c);
    await c.query("COMMIT");
    return r;
  } catch (e) {
    await c.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    c.release();
  }
}

/** Append-only. Each entry runs once, in order, inside one transaction. */
const MIGRATIONS = [
  `CREATE TABLE users (
     id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     google_sub     text UNIQUE NOT NULL,
     email          text,
     name           text,
     avatar         text NOT NULL DEFAULT '🦊',
     chips          bigint NOT NULL DEFAULT 0 CHECK (chips >= 0),
     -- Chips currently on a table. Returned to \`chips\` if the server stops without cashing out.
     in_play        bigint NOT NULL DEFAULT 0 CHECK (in_play >= 0),
     last_bonus_day date,
     banned         boolean NOT NULL DEFAULT false,
     created_at     timestamptz NOT NULL DEFAULT now()
   );
   CREATE TABLE chip_ledger (
     id         bigserial PRIMARY KEY,
     user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     delta      bigint NOT NULL,
     balance    bigint NOT NULL,
     reason     text NOT NULL,
     created_at timestamptz NOT NULL DEFAULT now()
   );
   CREATE INDEX chip_ledger_user_idx ON chip_ledger (user_id, created_at DESC);`,
];

export async function migrate() {
  await tx(async (c) => {
    // Serialise concurrent boots.
    await c.query("SELECT pg_advisory_xact_lock(7461)");
    await c.query("CREATE TABLE IF NOT EXISTS schema_migrations (version int PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())");
    const { rows } = await c.query<{ v: number | null }>("SELECT max(version) AS v FROM schema_migrations");
    const current = rows[0]?.v ?? 0;
    for (let i = current; i < MIGRATIONS.length; i++) {
      await c.query(MIGRATIONS[i]!);
      await c.query("INSERT INTO schema_migrations (version) VALUES ($1)", [i + 1]);
      console.log(`applied migration ${i + 1}`);
    }
  });
}
