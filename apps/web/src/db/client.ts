import { drizzle } from "drizzle-orm/bun-sql";
import { Redacted } from "effect";
import * as schema from "./schema";

type BunSQLInstance = {
  close(options?: { timeout?: number }): Promise<void>;
};

export type AppDatabase = ReturnType<typeof drizzle<typeof schema>>;

export function createDatabase(url: Redacted.Redacted<string>): {
  db: AppDatabase;
  sql: BunSQLInstance;
} {
  const sql = new (
    globalThis as unknown as {
      Bun: { SQL: new (opts: { url: string; max?: number }) => BunSQLInstance };
    }
  ).Bun.SQL({
    url: Redacted.value(url),
    max: 5,
  });
  return { db: drizzle(sql as never, { schema }), sql };
}
