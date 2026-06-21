import { Layer, ManagedRuntime } from "effect";
import { CustomWidgetRepo } from "./services/CustomWidgetRepo";
import { LayoutRepo } from "./services/LayoutRepo";
import { PageRepo } from "./services/PageRepo";
import { SessionStore } from "./services/SessionStore";
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
  CustomWidgetRepo.Default,
  ZoneRepo.Default,
);

export const runtime = ManagedRuntime.make(MainLive);

export type AppRuntime = typeof runtime;
