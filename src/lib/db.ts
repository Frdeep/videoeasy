import "server-only";
import { Pool, type PoolClient } from "pg";
import { env } from "./config";
let pool: Pool;
export function db() {
  return (pool ??= new Pool({
    connectionString: env("DATABASE_URL"),
    max: 5,
    connectionTimeoutMillis: 10000,
  }));
}
// Dedicated connection: session lock spans durable commits and Stripe network calls.
// Use direct PostgreSQL or Supabase SESSION pooler, never transaction-mode pooler.
export async function withUserLock<T>(
  userId: string,
  work: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await db().connect();
  let broken = false;
  try {
    await client.query("select pg_advisory_lock(hashtextextended($1, 0))", [
      userId,
    ]);
    return await work(client);
  } finally {
    try {
      await client.query("rollback");
      await client.query("select pg_advisory_unlock(hashtextextended($1, 0))", [
        userId,
      ]);
    } catch {
      broken = true;
    }
    client.release(broken);
  }
}
export async function transaction<T>(
  client: PoolClient,
  work: () => Promise<T>,
) {
  await client.query("begin");
  try {
    const value = await work();
    await client.query("commit");
    return value;
  } catch (error) {
    await client.query("rollback");
    throw error;
  }
}
