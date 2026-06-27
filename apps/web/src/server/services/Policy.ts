import { Data, Effect } from "effect";
import { CurrentUser } from "./CurrentUser";
import type { UserId } from "@/db/schema/users";

export class Forbidden extends Data.TaggedError("Forbidden")<{
  readonly action: string;
  readonly resource?: string;
}> {}

const hasRole = (roles: ReadonlyArray<string>, role: string) => roles.includes(role);

export const Policy = {
  canReadUser: (targetId: UserId) =>
    Effect.gen(function* () {
      const user = yield* CurrentUser;
      if (user.id === targetId || hasRole(user.roles, "admin")) return;
      return yield* Effect.fail(new Forbidden({ action: "user:read", resource: targetId }));
    }),

  canListUsers: Effect.gen(function* () {
    const user = yield* CurrentUser;
    if (hasRole(user.roles, "admin")) return;
    return yield* Effect.fail(new Forbidden({ action: "user:list" }));
  }),

  canCreateUser: Effect.gen(function* () {
    const user = yield* CurrentUser;
    if (hasRole(user.roles, "admin")) return;
    return yield* Effect.fail(new Forbidden({ action: "user:create" }));
  }),

  canUpdateUser: (targetId: UserId) =>
    Effect.gen(function* () {
      const user = yield* CurrentUser;
      if (user.id === targetId || hasRole(user.roles, "admin")) return;
      return yield* Effect.fail(new Forbidden({ action: "user:update", resource: targetId }));
    }),

  // Layouts are global, admin-managed content — no per-row ownership.
  canListLayouts: Effect.gen(function* () {
    const user = yield* CurrentUser;
    if (hasRole(user.roles, "admin")) return;
    return yield* Effect.fail(new Forbidden({ action: "layout:list" }));
  }),

  canReadLayout: Effect.gen(function* () {
    const user = yield* CurrentUser;
    if (hasRole(user.roles, "admin")) return;
    return yield* Effect.fail(new Forbidden({ action: "layout:read" }));
  }),

  canCreateLayout: Effect.gen(function* () {
    const user = yield* CurrentUser;
    if (hasRole(user.roles, "admin")) return;
    return yield* Effect.fail(new Forbidden({ action: "layout:create" }));
  }),

  canUpdateLayout: Effect.gen(function* () {
    const user = yield* CurrentUser;
    if (hasRole(user.roles, "admin")) return;
    return yield* Effect.fail(new Forbidden({ action: "layout:update" }));
  }),

  // Custom widget definitions are global, admin-managed content — no per-row ownership.
  canListCustomWidgets: Effect.gen(function* () {
    const user = yield* CurrentUser;
    if (hasRole(user.roles, "admin")) return;
    return yield* Effect.fail(new Forbidden({ action: "customWidget:list" }));
  }),

  canReadCustomWidget: Effect.gen(function* () {
    const user = yield* CurrentUser;
    if (hasRole(user.roles, "admin")) return;
    return yield* Effect.fail(new Forbidden({ action: "customWidget:read" }));
  }),

  canCreateCustomWidget: Effect.gen(function* () {
    const user = yield* CurrentUser;
    if (hasRole(user.roles, "admin")) return;
    return yield* Effect.fail(new Forbidden({ action: "customWidget:create" }));
  }),

  canUpdateCustomWidget: Effect.gen(function* () {
    const user = yield* CurrentUser;
    if (hasRole(user.roles, "admin")) return;
    return yield* Effect.fail(new Forbidden({ action: "customWidget:update" }));
  }),

  canDeleteCustomWidget: Effect.gen(function* () {
    const user = yield* CurrentUser;
    if (hasRole(user.roles, "admin")) return;
    return yield* Effect.fail(new Forbidden({ action: "customWidget:delete" }));
  }),

  // Pages are global, admin-managed content — listing is admin-only.
  canListPages: Effect.gen(function* () {
    const user = yield* CurrentUser;
    if (hasRole(user.roles, "admin")) return;
    return yield* Effect.fail(new Forbidden({ action: "page:list" }));
  }),

  // Zones are a fixed, admin-managed catalog — no per-row ownership.
  canListZones: Effect.gen(function* () {
    const user = yield* CurrentUser;
    if (hasRole(user.roles, "admin")) return;
    return yield* Effect.fail(new Forbidden({ action: "zone:list" }));
  }),

  // Menus are global, admin-managed content — no per-row ownership.
  canListMenus: Effect.gen(function* () {
    const user = yield* CurrentUser;
    if (hasRole(user.roles, "admin")) return;
    return yield* Effect.fail(new Forbidden({ action: "menu:list" }));
  }),

  canReadMenu: Effect.gen(function* () {
    const user = yield* CurrentUser;
    if (hasRole(user.roles, "admin")) return;
    return yield* Effect.fail(new Forbidden({ action: "menu:read" }));
  }),

  canCreateMenu: Effect.gen(function* () {
    const user = yield* CurrentUser;
    if (hasRole(user.roles, "admin")) return;
    return yield* Effect.fail(new Forbidden({ action: "menu:create" }));
  }),

  canUpdateMenu: Effect.gen(function* () {
    const user = yield* CurrentUser;
    if (hasRole(user.roles, "admin")) return;
    return yield* Effect.fail(new Forbidden({ action: "menu:update" }));
  }),

  canDeleteMenu: Effect.gen(function* () {
    const user = yield* CurrentUser;
    if (hasRole(user.roles, "admin")) return;
    return yield* Effect.fail(new Forbidden({ action: "menu:delete" }));
  }),

  // Taxonomies are global, admin-managed lookup content — no per-row ownership.
  canListTaxonomies: Effect.gen(function* () {
    const user = yield* CurrentUser;
    if (hasRole(user.roles, "admin")) return;
    return yield* Effect.fail(new Forbidden({ action: "taxonomy:list" }));
  }),

  canReadTaxonomy: Effect.gen(function* () {
    const user = yield* CurrentUser;
    if (hasRole(user.roles, "admin")) return;
    return yield* Effect.fail(new Forbidden({ action: "taxonomy:read" }));
  }),

  canCreateTaxonomy: Effect.gen(function* () {
    const user = yield* CurrentUser;
    if (hasRole(user.roles, "admin")) return;
    return yield* Effect.fail(new Forbidden({ action: "taxonomy:create" }));
  }),

  canUpdateTaxonomy: Effect.gen(function* () {
    const user = yield* CurrentUser;
    if (hasRole(user.roles, "admin")) return;
    return yield* Effect.fail(new Forbidden({ action: "taxonomy:update" }));
  }),

  canDeleteTaxonomy: Effect.gen(function* () {
    const user = yield* CurrentUser;
    if (hasRole(user.roles, "admin")) return;
    return yield* Effect.fail(new Forbidden({ action: "taxonomy:delete" }));
  }),

  // Config is global, admin-managed site settings — no per-row ownership.
  canReadConfig: Effect.gen(function* () {
    const user = yield* CurrentUser;
    if (hasRole(user.roles, "admin")) return;
    return yield* Effect.fail(new Forbidden({ action: "config:read" }));
  }),

  canManageConfig: Effect.gen(function* () {
    const user = yield* CurrentUser;
    if (hasRole(user.roles, "admin")) return;
    return yield* Effect.fail(new Forbidden({ action: "config:manage" }));
  }),
};
