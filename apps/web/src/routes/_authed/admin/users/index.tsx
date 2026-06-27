import { useEffect, useRef, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
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
import { usersRepo, type SafeUser } from "@/repositories/users";

export const Route = createFileRoute("/_authed/admin/users/")({
  validateSearch: ListUsersSearch,
  loaderDeps: ({ search }) => search,
  loader: ({ context, deps }) =>
    context.queryClient.ensureQueryData(usersRepo.list(toListParams(deps))),
  component: RouteComponent,
});

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
});

const columns: ColumnDef<SafeUser>[] = [
  {
    accessorKey: "username",
    header: "Username",
    cell: ({ row }) => (
      <Link to="/admin/users/$userId" params={{ userId: row.original.id }}>
        {row.original.username}
      </Link>
    ),
  },
  {
    accessorKey: "firstName",
    header: "First name",
    cell: ({ row }) => row.original.firstName ?? "—",
  },
  {
    accessorKey: "lastName",
    header: "Last name",
    cell: ({ row }) => row.original.lastName ?? "—",
  },
  {
    accessorKey: "email",
    header: "Email",
  },
  {
    accessorKey: "roles",
    header: "Roles",
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
    header: "Created",
    cell: ({ row }) => dateFormatter.format(new Date(row.original.created)),
  },
];

function RouteComponent() {
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
        <h1>Users</h1>
        <Input
          type="search"
          placeholder="Search username or email…"
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
                <TableCell colSpan={columns.length}>No users found.</TableCell>
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
            {totalCount === 0 ? "No results" : `${firstItem}–${lastItem} of ${totalCount} users`}
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
              ← Prev
            </Button>
            <span style={{ fontSize: "var(--fontSize-sm)", whiteSpace: "nowrap" }}>
              Page {pageNumber} of {pageCount}
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
              Next →
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
            Per page
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
