---
name: entity-pagination
description: Add or update JSON:API-compliant list pagination, sorting, and filtering for an entity (Drizzle repo, TanStack Start server fn, REST route, and a TanStack Router admin page). Use when wiring `?sort=`, `?filter[…]`, `?page[number]`/`?page[size]` for a list view.
---

# Entity Pagination (JSON:API)

This skill adds server-side **pagination + sorting + filtering** to an entity list,
following JSON:API query-parameter conventions, and wires it through every layer:
Drizzle repo → Effect service → TanStack Start server fn → client repo → admin
route → public REST route.

**Canonical reference implementation: `user`.** When in doubt, read these and mirror them:

- `apps/web/src/db/schema/users.ts` (schemas + `toListParams`)
- `apps/web/src/server/services/UserRepo.ts` (`list`)
- `apps/web/src/server/fns/users.ts` (`listUsersFn`)
- `apps/web/src/repositories/users.ts` (query options + keys)
- `apps/web/src/routes/_authed/admin/users/index.tsx` (admin page)
- `apps/web/src/routes/api/users/index.ts` (public REST surface)

## JSON:API URL contract

The browser URL **and** the public REST API use the reserved query families:

```
/admin/users?sort=-created&filter[search]=bob&page[number]=2&page[size]=50
```

- `sort` — single field, leading `-` means **descending** (`sort=-created`, `sort=username`).
- `filter[…]` — bracketed member family (e.g. `filter[search]`).
- `page[number]` / `page[size]` — bracketed pagination family.

## Two representations — keep them separate

1. **URL / wire shape** (`<Entity>Search`, JSON:API: `sort`, `filter`, `page`) — what the
   router serializes and what REST clients send. This is the canonical search state.
2. **Internal flat params** (`List<Entity>Params`: `sortBy`, `sortDir`, `search`,
   `pageNumber`, `pageSize`) — what the repo/RPC consume.

`toListParams()` is the **only** translation point (URL shape → flat params). Never flatten
inside `validateSearch` — the object `validateSearch` returns is what gets re-serialized to
the URL, so it must stay in JSON:API shape.

## One-time global setup (already done — verify, don't duplicate)

These exist project-wide; confirm before assuming a new entity needs them:

- **`apps/web/src/router.tsx`** — `qs`-based `parseSearch`/`stringifySearch` give bracket
  notation. If missing, add it (router-wide, affects all routes). Requires `qs` + `@types/qs`.
- **`apps/web/src/lib/APIResponse.tsx`** — `JsonApiCollection<T>` has a `meta?` field.

Installing deps (containerized — **never** run `bun add` on the host):

```
docker compose exec web bun add qs
docker compose exec web bun add -d @types/qs
```

## Per-entity steps

### 1. Schema — `apps/web/src/db/schema/<entity>.ts`

Add (copy the `users.ts` block, swap names + sort fields + filter members):

- `PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const` and `PageSize` (or reuse a shared one).
- `List<Entity>Input` — **flat** Zod schema (repo/server-fn contract): `search?`, `sortBy`
  (enum of sortable columns), `sortDir`, `pageNumber` (coerce, min 1, default 1), `pageSize`
  (coerce, refine ∈ `PAGE_SIZE_OPTIONS`, default 20). Export `List<Entity>Params = z.infer<…>`.
- `List<Entity>PagedMeta` type: `{ totalCount, pageCount, pageNumber, pageSize }`.
- `SORT_VALUES` — `[...fields, ...fields.map(f => \`-\${f}\`)] as const`;`SortValue` type.
- `List<Entity>Search` — **JSON:API** Zod schema: `sort` (enum `SORT_VALUES`, `.catch().default()`),
  `filter` (`.object({ search: … }).optional()`), `page` (`.object({ number, size })` with
  coerce + `.catch().default()`). Use `.catch(...)` on leaves so stale bookmarks degrade.
  Every member must be optional/defaulted so the schema parses `{}` — this is what lets
  `/admin/<entity>` load with no query params and keeps `search` optional on `<Link>`.
- `toListParams(s: List<Entity>SearchParams): List<Entity>Params` — split `sort` into
  `sortBy`/`sortDir`, lift `filter.search`, map `page.number/size`.

### 2. Repo service — `apps/web/src/server/services/<Entity>Repo.ts`

`list(params: List<Entity>Params)` runs the page query and a `count()` in parallel and
returns `{ rows, totalCount }`:

```ts
const { pageNumber, pageSize } = params;
const offset = (pageNumber - 1) * pageSize;
const [rows, [totals]] = await Promise.all([
  db.query.<entity>.findMany({ where, orderBy, limit: pageSize, offset }),
  db.select({ totalCount: count() }).from(<entity>).where(where),
]);
return { rows, totalCount: totals?.totalCount ?? 0 };
```

Keep the `Policy.can*` gate and `DatabaseError` mapping as in `UserRepo`.

### 3. Server fn — `apps/web/src/server/fns/<entity>.ts`

`list<Entity>Fn` validates with `List<Entity>Input`, calls `repo.list`, computes
`pageCount = Math.ceil(totalCount / pageSize)`, returns `{ data: rows.map(parse), meta }`.

### 4. Client repo — `apps/web/src/repositories/<entity>.ts`

Re-export `List<Entity>PagedMeta`. `list(params)` → `queryOptions` whose `queryKey`
**includes the full params object** (so each page/sort/filter is cached distinctly).

### 5. Admin route — `apps/web/src/routes/_authed/admin/<entity>/index.tsx`

- `validateSearch: List<Entity>Search` — pass the Zod schema **directly**, not a
  `(raw) => …parse(raw)` wrapper. The wrapper hides the schema's optional *input* type, which
  forces every typed `<Link>` to supply a full `search` prop. Passing the schema lets TanStack
  read its input type, so `search` is optional on links.
- `loaderDeps: ({ search }) => search`
- `loader: ({ context, deps }) => context.queryClient.ensureQueryData(<entity>Repo.list(toListParams(deps)))`
- In the component: `const search = Route.useSearch()`, `const navigate = Route.useNavigate()`.
- Query: `useQuery({ ...repo.list(toListParams(search)), placeholderData: keepPreviousData })`.
- Build `SortingState` from `search.sort`; navigation handlers write the **JSON:API shape**
  (`{ ...prev, sort, page: { ...prev.page, number: 1 } }`, etc.).
- Search input is local state + debounced → `filter`; resets `page.number` to 1.
- Use `replace: true` for search/sort/page-size changes; default push for prev/next.
- Inbound links are just `<Link to="/admin/<entity>">` — **no** `search` prop. The schema
  defaults fill in `sort`/`page`, so don't force a `DEFAULT_<ENTITY>_SEARCH` object.

### 5a. Base58 ids in the browser URL

The entity's id route (`$<entity>Id`) shows the id as **base58** (~22 chars) in the address
bar, not the raw uuid. Convert only at the route boundary — storage, server fns, repos,
query keys, and the REST API all keep the full uuid v7.

- On the detail route, add `params: idParam("<entity>Id")` from `@/lib/shortId`. `parse`
  decodes base58 → uuid (and 404s on garbage), `stringify` encodes back. Params stay typed
  as `string` (so links don't need branded casts); keep the usual `params.<entity>Id as
  <Entity>Id` cast in the loader and `Route.useParams()`.
- `<Link>` / `navigate({ params })` need **no** change: they pass the uuid and the router
  stringifies it to base58 in the rendered href.
- On the list page, add `data-id={row.original.id}` to the data-row `<TableRow>` so the raw
  uuid stays reachable from the DOM without re-decoding.
- The REST route below and its JSON:API `id`/`self` links stay **full uuid** (backend
  boundary). `short-uuid` is the only dep; install it containerized:
  `docker compose exec web bun add short-uuid`. Import the **named** `createTranslator`
  (the default export isn't callable under Bun's ESM interop).
- `@/lib/shortId` (`encodeId`/`decodeId`/`idParam`) is the single conversion point; its unit
  tests in `apps/web/src/lib/shortId.test.ts` are the reference for the expected behavior
  (round-trip, base58 alphabet, `notFound` on malformed input).

### 6. Public REST route — `apps/web/src/routes/api/<entity>/index.ts`

```ts
const search = List<Entity>Search.parse(qs.parse(url.search, { ignoreQueryPrefix: true }));
const listParams = toListParams(search);
// … repo.list(listParams) …
const pageLink = (n: number) =>
  `${base}?${qs.stringify({ ...search, page: { ...search.page, number: n } }, { encodeValuesOnly: true })}`;
```

Return `meta: { totalCount, pageCount, pageNumber, pageSize }` and `links`
(`self`, `first`, `last`, conditional `prev`/`next`) via `negotiate(...)`. `pageLink` must
preserve `sort` + `filter`.

## Verify

Run inside the container (host JS is blocked):

```sh
docker compose exec web bun run tsc --noEmit
docker compose exec web bun run lint
```

Sanity-check the qs round-trip produces real brackets:

```sh
docker compose exec -T web bun -e 'const qs=require("qs"); console.log(qs.stringify({sort:"-created",filter:{search:"bob"},page:{number:2,size:50}},{encodeValuesOnly:true}))'
# → sort=-created&filter[search]=bob&page[number]=2&page[size]=50
```

## Gotchas

- `validateSearch` must return the JSON:API shape, not flattened — else the URL loses brackets.
- Assign the schema to `validateSearch` directly; a `(raw) => …parse(raw)` wrapper erases the
  optional input type and makes `search` a required prop on every typed `<Link>`.
- `page`/`filter` numbers arrive from qs as **strings**; rely on `z.coerce`/`.catch()` in the schema.
- Query keys must include the params object, or pages collide in the cache.
- Default-export `qs` (`import qs from "qs"`); it has no named exports.
- Never run `bun add` / `bun install` on the host — always `docker compose exec web …`.
