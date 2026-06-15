export { Database, DatabaseLive } from "./layer";
export { createDatabase, type AppDatabase } from "./client";
export * as schema from "./schema";

// import { SQL } from "bun";
// import { drizzle } from "drizzle-orm/bun-sql";
// import { Context, Layer } from "effect";
//
// class DrizzleDB extends Context.Tag("DrizzleDB")<DrizzleDB, ReturnType<typeof drizzle>>() {}
//
// export const DrizzleLive = Layer.sync(DrizzleDB, () => {
//   const client = new SQL(process.env.DATABASE_URL!);
//   return drizzle({ client });
// });
