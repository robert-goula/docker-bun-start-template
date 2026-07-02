import { Effect } from "effect";
import { Database, DatabaseLive } from "@/db";
import { layouts } from "@/db/schema/layouts";
import { layoutZones } from "@/db/schema/layoutZones";
import { tenants } from "@/db/schema/tenants";
import { users } from "@/db/schema/users";
import { zones } from "@/db/schema/zones";
import { layoutZones as layoutZoneSeed } from "@/db/seeding/layoutZones";
import { layouts as layoutSeed } from "@/db/seeding/layouts";
import { tenants as tenantSeed } from "@/db/seeding/tenants";
import { users as userSeed } from "@/db/seeding/users";
import { zones as zoneSeed } from "@/db/seeding/zones";

const program = Effect.gen(function* () {
  const db = yield* Database;

  // Tenants first — the admin user references one via tenantId (FK).
  yield* Effect.promise(() => db.insert(tenants).values(tenantSeed).onConflictDoNothing());

  // Admin only, for now (first entry of the user seed).
  const admin = userSeed[0];
  if (admin) {
    yield* Effect.promise(() => db.insert(users).values(admin).onConflictDoNothing());
  }

  yield* Effect.promise(() => db.insert(zones).values(zoneSeed).onConflictDoNothing());

  // Layouts plus their layoutZone instances, mirroring LayoutRepo.create. Without the
  // `default` layout and its zones, PageRepo.resolveDefaultLayoutId throws and every page
  // load 500s. Done in a transaction so each layout and its zones land together. The seed
  // declares layoutZones by name; we resolve those to the DB-generated ids here.
  const layoutZoneCount = yield* Effect.promise(() =>
    db.transaction(async (tx) => {
      await tx.insert(layouts).values(layoutSeed).onConflictDoNothing();

      const layoutCatalog = await tx.query.layouts.findMany();
      const zoneCatalog = await tx.query.zones.findMany();
      const layoutIdByName = new Map(layoutCatalog.map((l) => [l.name, l.id]));
      const zoneIdByName = new Map(zoneCatalog.map((z) => [z.name, z.id]));

      const values = layoutZoneSeed.map((seed) => {
        const layoutId = layoutIdByName.get(seed.layout);
        const zoneId = zoneIdByName.get(seed.zone);
        if (!layoutId) throw new Error(`layout "${seed.layout}" missing after insert`);
        if (!zoneId) throw new Error(`zone "${seed.zone}" missing after insert`);
        return { layoutId, zoneId, options: seed.options, createdBy: admin?.id ?? null };
      });
      if (values.length > 0) {
        await tx.insert(layoutZones).values(values).onConflictDoNothing();
      }
      return values.length;
    }),
  );

  yield* Effect.log(
    `Seeded ${tenantSeed.length} tenants, ${admin ? 1 : 0} user, ${zoneSeed.length} zones, ${layoutSeed.length} layout(s), ${layoutZoneCount} layout zones`,
  );
});

// `Effect.provide(DatabaseLive)` builds the scoped layer and runs its finalizer
// (closes the Bun SQL pool) so the process exits cleanly.
Effect.runPromise(program.pipe(Effect.provide(DatabaseLive)))
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
