import { Layer, ManagedRuntime } from "effect";
import { ConfigRepo } from "./services/ConfigRepo";
import { CustomWidgetRepo } from "./services/CustomWidgetRepo";
import { LayoutRepo } from "./services/LayoutRepo";
import { LayoutWidgetRepo } from "./services/LayoutWidgetRepo";
import { MenuRepo } from "./services/MenuRepo";
import { PageRepo } from "./services/PageRepo";
import { SessionStore } from "./services/SessionStore";
import { TaxonomyRepo } from "./services/TaxonomyRepo";
import { TenantRepo } from "./services/TenantRepo";
import { UserRepo } from "./services/UserRepo";
import { ZoneRepo } from "./services/ZoneRepo";

if (typeof window !== "undefined") {
  throw new Error("@/server/runtime must not be imported from client code");
}

const MainLive = Layer.mergeAll(
  UserRepo.Default,
  SessionStore.Default,
  PageRepo.Default,
  LayoutRepo.Default,
  LayoutWidgetRepo.Default,
  CustomWidgetRepo.Default,
  MenuRepo.Default,
  TaxonomyRepo.Default,
  ZoneRepo.Default,
  ConfigRepo.Default,
  TenantRepo.Default,
);

export const runtime = ManagedRuntime.make(MainLive);

// The ManagedRuntime holds the scopes of DatabaseLive and RedisLive open for its
// whole lifetime; their finalizers (closing the Bun SQL pool and Redis client) only
// run when the runtime is disposed. Wire that up so connections are actually released.
if (import.meta.hot) {
  // Dev: release the old runtime's DB pool + Redis client before HMR swaps in a new
  // module, otherwise reloads accumulate connections against the pool's `max`.
  import.meta.hot.dispose(() => void runtime.dispose());
} else {
  // Prod: drain connections on graceful shutdown so finalizers run before exit.
  const shutdown = () => void runtime.dispose().then(() => process.exit(0));
  process.once("SIGTERM", shutdown);
  process.once("SIGINT", shutdown);
}

export type AppRuntime = typeof runtime;
