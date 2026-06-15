import { customType } from "drizzle-orm/pg-core";

/**
 * jsonb column that stores real JSON objects.
 *
 * drizzle's built-in `jsonb` type `JSON.stringify`s the value before binding it;
 * the bun-sql driver then JSON-encodes that string a second time, producing a
 * double-encoded jsonb *string scalar* (e.g. `"{\"order\":3}"`). That breaks
 * SQL access like `options->>'order'` (it returns NULL) and any `ORDER BY` on it.
 *
 * Passing the value through unmodified lets the driver encode it exactly once, so
 * the column holds a proper jsonb object. The generated DDL is still `jsonb`, so
 * this is a drop-in replacement that needs no migration.
 */
export const jsonb = <TData = unknown>(name: string) =>
  customType<{ data: TData; driverData: TData }>({
    dataType() {
      return "jsonb";
    },
    toDriver(value: TData): TData {
      return value;
    },
  })(name);
