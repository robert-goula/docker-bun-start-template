---
name: soft-delete
description: Add reversible soft delete (deleted/deletedBy timestamps) to an entity, with restore, admin-only permanent delete, name reuse via a partial unique index, and an active/deleted status filter. Wires the Drizzle schema, Effect repo, TanStack Start server fns, client repo, and admin edit UI. Use when a row should be recoverably hidden instead of hard-deleted.
---

# Soft Delete

Make an entity's rows **recoverably deletable**: a soft delete stamps `deleted`/`deletedBy`
(and hides the row from normal lists/lookups) instead of removing it. The row can be
**restored** (clears both columns) or, once soft-deleted, **permanently deleted** by an admin.

This skill layers on top of the JSON:API list wiring (see the **entity-pagination** skill) —
soft delete adds a `status` filter (`active` default / `deleted`) to that list. Do
entity-pagination first (or alongside), then add the pieces below.

**Canonical reference implementation: `tenant`.** Mirror these when in doubt:

- `apps/web/src/db/schema/tenants.ts` — columns, partial unique index, `status` in the list schemas
- `apps/web/src/server/services/TenantRepo.ts` — `softDelete` / `restore` / `permanentDelete`, PG-code error mapping
- `apps/web/src/server/services/Policy.ts` — `canDeleteTenant` / `canPermanentlyDeleteTenant`
- `apps/web/src/server/fns/tenants.ts` — server fns + per-fn `catchTags`
- `apps/web/src/repositories/tenants.ts` — `softDelete` / `restore` / `permanentDelete` mutations
- `apps/web/src/routes/{-$locale}/_authed/admin/tenants/$tenantId.tsx` — delete/restore/permanent-delete UI
- `apps/web/src/routes/{-$locale}/_authed/admin/tenants/index.tsx` — Active/Deleted status toggle + deleted column

## The model

Two nullable columns, always moved together:

- **active**: `deleted IS NULL`, `deletedBy IS NULL`
- **soft-deleted**: `deleted = <ts>`, `deletedBy = <userId>`

Soft delete sets both; **restore clears both** (deletedBy goes back to NULL, not left stale).
Hard delete (`permanentDelete`) is only allowed on an already soft-deleted row.

## 1. Schema — `apps/web/src/db/schema/<entity>.ts`

Add the two columns (camelCase, no explicit column-name string, matching audit-col style):

```ts
deleted: timestamp({ precision: 3, withTimezone: true }),   // null while active
deletedBy: uuid(),                                          // null while active
```

**Free the name on delete** with a *partial* unique index so a soft-deleted name can be
reused by a new active row. Replace any plain `unique()` on the human-facing column:

```ts
(t) => ({
  <entity>_name_active_idx: uniqueIndex("<entity>_name_active_idx")
    .on(t.name)
    .where(sql`${t.deleted} is null`),
}),
```

Extend the select schema to coerce the new nullable date, and **omit** `deleted`/`deletedBy`
from the insert schema (they're never client-set):

```ts
export const select<Entity>Schema = createSelectSchema(<entity>).extend({
  created: z.coerce.date(),
  updated: z.coerce.date().nullable(),
  deleted: z.coerce.date().nullable(),
});
```

**Add the status filter to the list schemas** (this is the soft-delete-specific part of the
entity-pagination wiring):

```ts
export const <ENTITY>_STATUSES = ["active", "deleted"] as const;
export type <Entity>Status = (typeof <ENTITY>_STATUSES)[number];

// flat repo input (List<Entity>Input):
status: z.enum(<ENTITY>_STATUSES).default("active"),

// JSON:API filter (List<Entity>Search.filter):
status: z.enum(<ENTITY>_STATUSES).catch("active").optional(),

// toListParams:
status: s.filter?.status ?? "active",
```

## 2. Migration

Generate + apply inside the container (drizzle-kit). The generated SQL should drop the old
unique constraint, add `deleted`/`deletedBy`, and create the partial unique index — review it
before applying:

```sh
docker compose exec web bun run db:generate
docker compose exec web bun run db:migrate
```

## 3. Repo — `apps/web/src/server/services/<Entity>Repo.ts`

**Errors** (tagged): reuse `<Entity>NotFound` + `DatabaseError`, and add:

```ts
export class <Entity>NotDeleted extends Data.TaggedError("<Entity>NotDeleted")<{ readonly id: <Entity>Id }> {}
export class <Entity>InUse    extends Data.TaggedError("<Entity>InUse")<{ readonly id: <Entity>Id }> {}
```

Map Postgres error codes off the caught cause (a hard delete blocked by an FK surfaces as
`23503`; a name collision on the partial index as `23505`):

```ts
const PG_UNIQUE_VIOLATION = "23505";
const PG_FK_VIOLATION = "23503";
const pgCode = (cause: unknown): string | undefined =>
  typeof cause === "object" && cause !== null ? (cause as { code?: string }).code : undefined;
```

**`list`** — branch the base `where` on status so soft-deleted rows are excluded by default:

```ts
const statusWhere = params.status === "deleted" ? isNotNull(<entity>.deleted) : isNull(<entity>.deleted);
```

**`findById`** — reads **any** row incl. soft-deleted (the edit screen needs deleted rows).

**Any "active-only" lookup** (e.g. an id→summary batch feeding a picker/switcher) must add
`isNull(<entity>.deleted)` so soft-deleted rows disappear there even if still referenced
elsewhere. (In `tenant`, `listByIds` does this for the switcher.)

**`softDelete`** — idempotent. Only flip rows that are currently active; if nothing flipped,
distinguish missing (→ `NotFound`) from already-deleted (return as-is):

```ts
const rows = await db.update(<entity>)
  .set({ deleted: new Date(), deletedBy: currentUser.id })
  .where(and(eq(<entity>.id, id), isNull(<entity>.deleted)))
  .returning();
if (rows[0]) return rows[0];
const existing = await db.query.<entity>.findFirst({ where: eq(<entity>.id, id) });
if (!existing) fail(new <Entity>NotFound({ id }));
return existing; // already soft-deleted
```

**`restore`** — clears both columns; can hit the partial unique index if an active row now
holds the name (→ map `23505` to `<Entity>NameConflict`):

```ts
.set({ deleted: null, deletedBy: null, updatedBy: currentUser.id })
```

**`permanentDelete`** — guard first: `NotFound` if missing, `<Entity>NotDeleted` if
`deleted` is null; then hard-delete, mapping `23503` → `<Entity>InUse`:

```ts
if (!existing) fail(new <Entity>NotFound({ id }));
if (!existing.deleted) fail(new <Entity>NotDeleted({ id }));
await db.delete(<entity>).where(eq(<entity>.id, id)); // catch FK 23503 → <Entity>InUse
```

## 4. Policy — `apps/web/src/server/services/Policy.ts`

`can<Delete>` gates soft delete **and** restore (they're the same admin action).
`canPermanently<Delete>` is a separate gate (still admin-only here, but distinct so it can be
tightened later). Both follow the existing `hasRole(user.roles, "admin")` / `Forbidden` shape.

## 5. Server fns — `apps/web/src/server/fns/<entity>.ts`

Add `softDelete<Entity>Fn`, `restore<Entity>Fn`, `permanentDelete<Entity>Fn` (POST,
`[authMiddleware]`, input `{ id }`). **Each fn gets its own inline `catchTags`** listing
exactly the errors it can raise — do **not** share one tag object across fns (an over-broad
map makes `catchTags` error on tags the fn can't produce and collapses the return type to
`unknown`). HTTP mapping:

| error | status |
|---|---|
| `<Entity>NotFound` | 404 |
| `Forbidden` | 403 |
| `<Entity>NotDeleted` | 422 |
| `<Entity>InUse` | 409 |
| `<Entity>NameConflict` (restore) | 409 |
| `<Entity>DatabaseError` | 500 |

`softDelete` tags: `{ NotFound, Forbidden, DatabaseError }`.
`restore` adds `NameConflict`. `permanentDelete`: `{ NotFound, Forbidden, NotDeleted, InUse, DatabaseError }`.

## 6. Client repo — `apps/web/src/repositories/<entity>.ts`

Add `softDelete` / `restore` / `permanentDelete` `mutationOptions` (input = `id`); each
invalidates `<entity>Keys.byId(id)` and `<entity>Keys.all` (`permanentDelete` only needs
`.all`). See the reference file.

## 7. Admin UI

**Edit page (`$<entity>Id.tsx`)** — `isDeleted = row.deleted != null`. When active: show a
**Delete** button (soft). When deleted: show **Restore**, plus **Permanently delete**
(admin-only, behind `window.confirm`) that navigates back to the list on success. Disable the
edit form while deleted. Localize every label/toast in the sibling `.content.ts`.

**List page (`index.tsx`)** — an **Active / Deleted** toggle writes `filter.status` (resetting
`page.number` to 1); show the create form only in the active view; add a **Deleted** column
(non-sortable) only when `status === "deleted"`.

## Verify

Inside the container (host JS is blocked):

```sh
docker compose exec web bun run tsc --noEmit
docker compose exec web bun run lint
```

Behavioral checks: soft delete hides from the active list and frees the name (create a new
active row with the same name); restore brings it back (409 if the name was re-taken);
permanent delete works only on a soft-deleted row (422 otherwise) and is blocked while a FK
still references it (409); a soft-deleted row stays reachable in `findById`/the edit screen but
vanishes from any active-only picker.

## Gotchas

- **Move both columns together.** Restore must NULL `deletedBy`, not leave it stale.
- **Partial unique index, not plain unique** — otherwise a soft-deleted name blocks reuse.
- **`softDelete` is idempotent** — a second call returns the row unchanged, never a false `NotFound`.
- **`findById` reads deleted rows; `list` and active-only lookups must exclude them** (`isNull(deleted)`).
- **Per-fn `catchTags`** — a shared error-tag object listing tags a given fn can't raise breaks
  its type. Match each fn's tags to its exact error union.
- **`permanentDelete` guards before deleting** — `NotFound` → `NotDeleted` → hard delete;
  map the FK violation (`23503`) to `<Entity>InUse`.
- Never run `bun add` / `bun install` on the host — always `docker compose exec web …`.
