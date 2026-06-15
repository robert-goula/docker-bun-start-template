import { createServerFn } from "@tanstack/react-start";
import { Effect } from "effect";
import * as z from "zod";
import { selectZoneSchema } from "@/db/schema/zones";
import { authMiddleware } from "@/server/fns/auth";
import { runtime } from "@/server/runtime";
import { CurrentUser } from "@/server/services/CurrentUser";
import { ZoneRepo } from "@/server/services/ZoneRepo";

export type SafeZone = z.infer<typeof selectZoneSchema>;

const forbidden = () => Effect.fail(new Response("Forbidden", { status: 403 }));
const dbError = () => Effect.fail(new Response("Internal Server Error", { status: 500 }));

export const listZonesFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(({ context }) =>
    runtime.runPromise(
      Effect.gen(function* () {
        const repo = yield* ZoneRepo;
        const rows = yield* repo.list;
        return rows.map((row) => selectZoneSchema.parse(row));
      }).pipe(
        Effect.provideService(CurrentUser, context.user),
        Effect.catchTags({ Forbidden: forbidden, DatabaseError: dbError }),
      ),
    ),
  );
