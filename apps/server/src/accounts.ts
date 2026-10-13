import { type AccountInfo, DAILY_BONUS, STARTING_BANKROLL } from "@felt/engine";
import type pg from "pg";
import { pool, tx } from "./db";

/**
 * The bankroll is the only source of truth for chips. Every change goes through
 * here, is serialised per user and recorded in `chip_ledger`.
 *
 * Chips on a table are tracked in `users.in_play`: buy-ins move chips from `chips`
 * to `in_play`, the stack is synced after every hand, and cashing out moves it back.
 * If the server dies mid-session, `recoverInPlay()` returns the last synced stacks.
 */

interface UserRow {
  id: string;
  name: string | null;
  avatar: string;
  chips: string;
  banned: boolean;
}

export interface Account extends AccountInfo {
  id: string;
  banned: boolean;
}

const toAccount = (r: UserRow): Account => ({
  id: r.id,
  name: r.name ?? "Player",
  avatar: r.avatar,
  chips: Number(r.chips),
  banned: r.banned,
});

export const publicInfo = (a: Account): AccountInfo => ({ name: a.name, avatar: a.avatar, chips: a.chips });

// Per-user queue so a cash-out can never interleave with a buy-in or stack sync.
const chains = new Map<string, Promise<unknown>>();
function serial<T>(userId: string, fn: () => Promise<T>): Promise<T> {
  const run = (chains.get(userId) ?? Promise.resolve()).catch(() => {}).then(fn);
  chains.set(userId, run);
  void run
    .catch(() => {})
    .finally(() => {
      if (chains.get(userId) === run) chains.delete(userId);
    });
  return run;
}

async function lockUser(c: pg.PoolClient, id: string): Promise<UserRow> {
  const { rows } = await c.query<UserRow>("SELECT id, name, avatar, chips, banned FROM users WHERE id = $1 FOR UPDATE", [id]);
  if (!rows[0]) throw new Error("Account not found");
  return rows[0];
}

async function ledger(c: pg.PoolClient, id: string, delta: number, balance: number, reason: string) {
  await c.query("INSERT INTO chip_ledger (user_id, delta, balance, reason) VALUES ($1, $2, $3, $4)", [id, delta, balance, reason]);
}

export async function getAccount(id: string): Promise<Account | null> {
  const { rows } = await pool.query<UserRow>("SELECT id, name, avatar, chips, banned FROM users WHERE id = $1", [id]);
  return rows[0] ? toAccount(rows[0]) : null;
}

/** Find or create the account for an identity (Google `sub`, or `dev:<name>` locally). */
export async function upsertUser(sub: string, email: string | null): Promise<Account> {
  return tx(async (c) => {
    const { rows } = await c.query<UserRow & { inserted: boolean }>(
      `INSERT INTO users (google_sub, email, chips, last_bonus_day) VALUES ($1, $2, $3, (now() AT TIME ZONE 'utc')::date)
       ON CONFLICT (google_sub) DO UPDATE SET email = COALESCE(EXCLUDED.email, users.email)
       RETURNING id, name, avatar, chips, banned, (xmax = 0) AS inserted`,
      [sub, email, STARTING_BANKROLL],
    );
    const row = rows[0]!;
    if (row.inserted) await ledger(c, row.id, STARTING_BANKROLL, STARTING_BANKROLL, "Welcome bankroll");
    return toAccount(row);
  });
}

/** Sets the profile. With `onlyIfUnset`, only fills in a brand-new account's name. */
export async function setProfile(id: string, name: string, avatar: string, onlyIfUnset = false): Promise<Account> {
  const { rows } = await pool.query<UserRow>(
    `UPDATE users SET name = $2, avatar = $3 WHERE id = $1 ${onlyIfUnset ? "AND name IS NULL" : ""}
     RETURNING id, name, avatar, chips, banned`,
    [id, name, avatar],
  );
  return rows[0] ? toAccount(rows[0]) : (await getAccount(id))!;
}

/** Once per UTC day. Returns the amount granted (0 if already claimed today). */
export function claimDailyBonus(id: string): Promise<{ amount: number; account: Account }> {
  return serial(id, () =>
    tx(async (c) => {
      const { rows } = await c.query<UserRow & { due: boolean }>(
        `SELECT id, name, avatar, chips, banned,
                (last_bonus_day IS NULL OR last_bonus_day < (now() AT TIME ZONE 'utc')::date) AS due
         FROM users WHERE id = $1 FOR UPDATE`,
        [id],
      );
      const row = rows[0];
      if (!row) throw new Error("Account not found");
      if (!row.due) return { amount: 0, account: toAccount(row) };
      // Top up broke players a bit more generously.
      const amount = Number(row.chips) < 1_000 ? DAILY_BONUS * 2 : DAILY_BONUS;
      const balance = Number(row.chips) + amount;
      await c.query("UPDATE users SET chips = $2, last_bonus_day = (now() AT TIME ZONE 'utc')::date WHERE id = $1", [id, balance]);
      await ledger(c, id, amount, balance, "Daily bonus");
      return { amount, account: { ...toAccount(row), chips: balance } };
    }),
  );
}

/** Move chips from the bankroll onto a table. Throws if the player can't afford it. */
export function buyIn(id: string, amount: number, reason: string): Promise<Account> {
  return serial(id, () =>
    tx(async (c) => {
      const row = await lockUser(c, id);
      if (row.banned) throw new Error("This account is suspended");
      const chips = Number(row.chips);
      if (amount <= 0) throw new Error("Invalid amount");
      if (chips < amount) throw new Error(`You only have ${chips.toLocaleString()} chips`);
      await c.query("UPDATE users SET chips = chips - $2, in_play = in_play + $2 WHERE id = $1", [id, amount]);
      await ledger(c, id, -amount, chips - amount, reason);
      return { ...toAccount(row), chips: chips - amount };
    }),
  );
}

/** Return a player's table stack to their bankroll and clear what's in play. */
export function cashOut(id: string, amount: number, reason: string): Promise<Account> {
  return serial(id, () =>
    tx(async (c) => {
      const row = await lockUser(c, id);
      const balance = Number(row.chips) + Math.max(0, amount);
      await c.query("UPDATE users SET chips = $2, in_play = 0 WHERE id = $1", [id, balance]);
      if (amount > 0) await ledger(c, id, amount, balance, reason);
      return { ...toAccount(row), chips: balance };
    }),
  );
}

/** Record current table stacks after a hand, so a crash returns at most one hand's worth of change. */
export function syncInPlay(stacks: { id: string; stack: number }[]): Promise<unknown> {
  return Promise.all(
    stacks.map(({ id, stack }) => serial(id, () => pool.query("UPDATE users SET in_play = $2 WHERE id = $1", [id, stack]))),
  );
}

/** On boot: anything still marked in play belongs to tables that no longer exist. */
export async function recoverInPlay(): Promise<number> {
  const r = await pool.query(
    `WITH moved AS (
       SELECT id, in_play FROM users WHERE in_play > 0 FOR UPDATE
     ), upd AS (
       UPDATE users u SET chips = u.chips + m.in_play, in_play = 0
       FROM moved m WHERE u.id = m.id
       RETURNING u.id, m.in_play AS amount, u.chips AS balance
     )
     INSERT INTO chip_ledger (user_id, delta, balance, reason)
     SELECT id, amount, balance, 'Returned from a table after a server restart' FROM upd`,
  );
  return r.rowCount ?? 0;
}
