import { useEffect, useMemo, useRef, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useIntlayer } from "react-intlayer";
import {
  type ColumnDef,
  type SortingState,
  type Updater,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  ListUsersSearch,
  PAGE_SIZE_OPTIONS,
  toListParams,
  type PageSize,
  type SortValue,
} from "@/db/schema/users";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import AdminCmsPage from "@/components/AdminCmsPage";
import { buildAdminHead, loadAdminPage } from "@/lib/loadPage";
import { usersRepo, type SafeUser } from "@/repositories/users";

// The admin users list is a page-builder–controlled page: it loads the CMS layout for this
// slug (auto-created on first load) so the editable nav/hero/footer chrome renders around
// the table, which is passed as CmsPage children (between the hero and main zones).
const USERS_PAGE_SLUG = "/admin/users";

export const Route = createFileRoute("/{-$locale}/_authed/admin/users/")({
  validateSearch: ListUsersSearch,
  loaderDeps: ({ search }) => search,
  loader: async ({ context, deps }) => {
    const ref = { slug: USERS_PAGE_SLUG, locale: context.i18n.locale };
    const [{ layout, meta, siteName }] = await Promise.all([
      loadAdminPage(context.queryClient, ref),
      context.queryClient.ensureQueryData(usersRepo.list(toListParams(deps))),
    ]);
    return { layout, meta, siteName, ref };
  },
  head: ({ loaderData }) =>
    loaderData ? buildAdminHead(loaderData.ref, loaderData.meta, loaderData.siteName) : {},
  component: RouteComponent,
});

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
});

function RouteComponent() {
  const { layout, meta, ref } = Route.useLoaderData();
  return (
    <AdminCmsPage pageRef={ref} layout={layout} meta={meta}>
      <UsersList />
    </AdminCmsPage>
  );
}

function UsersList() {
  const content = useIntlayer("adminUsers");
  const search = Route.useSearch();
  const navigate = Route.useNavigate();

  // Local input value for immediate feedback; initialized from the URL so bookmarks work.
  const [inputValue, setInputValue] = useState(search.filter?.search ?? "");
  const debouncedSearch = useDebouncedValue(inputValue, 300);

  // Track the URL's filter value in a ref so the effect can compare without
  // depending on it (which would cause spurious re-runs while typing).
  const urlSearchRef = useRef(search.filter?.search);
  urlSearchRef.current = search.filter?.search;

  // Push the debounced value into the URL as filter[search] (replace so typing
  // doesn't flood history). Reset to page 1 on a new query.
  useEffect(() => {
    const next = debouncedSearch.trim() || undefined;
    if (next === (urlSearchRef.current || undefined)) return;
    navigate({
      search: (prev) => ({
        ...prev,
        filter: next ? { search: next } : undefined,
        page: { ...prev.page, number: 1 },
      }),
      replace: true,
    });
  }, [debouncedSearch, navigate]);

  const sorting: SortingState = [
    { id: search.sort.replace(/^-/, ""), desc: search.sort.startsWith("-") },
  ];

  function handleSortingChange(updater: Updater<SortingState>) {
    const next = typeof updater === "function" ? updater(sorting) : updater;
    const sort = next[0];
    const field = sort?.id ?? "created";
    const sortValue = (sort?.desc ? `-${field}` : field) as SortValue;
    navigate({
      search: (prev) => ({ ...prev, sort: sortValue, page: { ...prev.page, number: 1 } }),
      replace: true,
    });
  }

  const columns = useMemo<ColumnDef<SafeUser>[]>(
    () => [
      {
        accessorKey: "username",
        header: content.colUsername.value,
        cell: ({ row }) => (
          <Link to="/{-$locale}/admin/users/$userId" params={{ userId: row.original.id }}>
            {row.original.username}
          </Link>
        ),
      },
      {
        accessorKey: "firstName",
        header: content.colFirstName.value,
        cell: ({ row }) => row.original.firstName ?? "—",
      },
      {
        accessorKey: "lastName",
        header: content.colLastName.value,
        cell: ({ row }) => row.original.lastName ?? "—",
      },
      {
        accessorKey: "email",
        header: content.colEmail.value,
      },
      {
        accessorKey: "roles",
        header: content.colRoles.value,
        enableSorting: false,
        cell: ({ row }) => (
          <span style={{ display: "inline-flex", gap: "0.25rem", flexWrap: "wrap" }}>
            {row.original.roles.map((role) => (
              <Badge key={role} size="sm">
                {role}
              </Badge>
            ))}
          </span>
        ),
      },
      {
        accessorKey: "created",
        header: content.colCreated.value,
        cell: ({ row }) => dateFormatter.format(new Date(row.original.created)),
      },
    ],
    [content],
  );

  const { data, isFetching } = useQuery({
    ...usersRepo.list(toListParams(search)),
    placeholderData: keepPreviousData,
  });

  const rows = data?.data ?? [];
  const meta = data?.meta;

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting },
    onSortingChange: handleSortingChange,
    manualSorting: true,
    manualFiltering: true,
    getCoreRowModel: getCoreRowModel(),
  });

  function handlePageSizeChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const size = Number(e.target.value) as PageSize;
    navigate({
      search: (prev) => ({ ...prev, page: { number: 1, size } }),
      replace: true,
    });
  }

  const pageNumber = search.page.number;
  const pageSize = search.page.size;
  const pageCount = meta?.pageCount ?? 1;
  const totalCount = meta?.totalCount ?? 0;
  const firstItem = totalCount === 0 ? 0 : (pageNumber - 1) * pageSize + 1;
  const lastItem = Math.min(pageNumber * pageSize, totalCount);

  return (
    <>
      <section className="full">
        <h1>{content.title}</h1>
        <Input
          type="search"
          placeholder={content.searchPlaceholder.value}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          style={{ maxWidth: "20rem", marginBlock: "1rem" }}
        />
        <Table data-busy={isFetching || undefined}>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const canSort = header.column.getCanSort();
                  const sorted = header.column.getIsSorted();
                  return (
                    <TableHead
                      key={header.id}
                      onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                      style={canSort ? { cursor: "pointer", userSelect: "none" } : undefined}
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {sorted === "asc" ? " ▲" : sorted === "desc" ? " ▼" : ""}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length}>{content.noUsers}</TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} data-id={row.original.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBlockStart: "1rem",
            flexWrap: "wrap",
            gap: "0.75rem",
          }}
        >
          <span style={{ fontSize: "var(--fontSize-sm)", color: "var(--text-muted)" }}>
            {totalCount === 0 ? (
              content.noResults
            ) : (
              <>
                {firstItem}–{lastItem} {content.of} {totalCount} {content.users}
              </>
            )}
          </span>

          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Button
              size="sm"
              variant="outline"
              disabled={pageNumber <= 1}
              onClick={() =>
                navigate({
                  search: (prev) => ({
                    ...prev,
                    page: { ...prev.page, number: prev.page.number - 1 },
                  }),
                })
              }
            >
              {content.prev}
            </Button>
            <span style={{ fontSize: "var(--fontSize-sm)", whiteSpace: "nowrap" }}>
              {content.page} {pageNumber} {content.of} {pageCount}
            </span>
            <Button
              size="sm"
              variant="outline"
              disabled={pageNumber >= pageCount}
              onClick={() =>
                navigate({
                  search: (prev) => ({
                    ...prev,
                    page: { ...prev.page, number: prev.page.number + 1 },
                  }),
                })
              }
            >
              {content.next}
            </Button>
          </div>

          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.4rem",
              fontSize: "var(--fontSize-sm)",
              color: "var(--text-muted)",
            }}
          >
            {content.perPage}
            <select
              value={pageSize}
              onChange={handlePageSizeChange}
              style={{
                color: "var(--text-primary)",
                backgroundColor: "var(--bg-sunken)",
                borderRadius: "var(--borderRadius-sm)",
                outline: "1px solid var(--border-default)",
                paddingBlock: "var(--spacing-xs)",
                paddingInline: "var(--spacing-md)",
                fontSize: "inherit",
                cursor: "pointer",
              }}
            >
              {PAGE_SIZE_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>
    </>
  );
}

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}
