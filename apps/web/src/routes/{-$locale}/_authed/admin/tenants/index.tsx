import { useEffect, useMemo, useRef, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useIntlayer } from "react-intlayer";
import { toast } from "sonner";
import {
  type ColumnDef,
  type SortingState,
  type Updater,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  ListTenantsSearch,
  PAGE_SIZE_OPTIONS,
  toListParams,
  type PageSize,
  type SortValue,
  type TenantStatus,
} from "@/db/schema/tenants";
import { AddIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldBody, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AdminCmsPage from "@/components/AdminCmsPage";
import { buildAdminHead, loadAdminPage } from "@/lib/loadPage";
import { tenantsRepo, type SafeTenant } from "@/repositories/tenants";

// Page-builder–controlled admin page (see users/index.tsx): loads the CMS chrome for this
// slug and renders the tenants management UI as its children.
const TENANTS_PAGE_SLUG = "/admin/tenants";

export const Route = createFileRoute("/{-$locale}/_authed/admin/tenants/")({
  validateSearch: ListTenantsSearch,
  loaderDeps: ({ search }) => search,
  loader: async ({ context, deps }) => {
    const ref = { slug: TENANTS_PAGE_SLUG, locale: context.i18n.locale };
    const [{ layout, meta, siteName }] = await Promise.all([
      loadAdminPage(context.queryClient, ref),
      context.queryClient.ensureQueryData(tenantsRepo.list(toListParams(deps))),
    ]);
    return { layout, meta, siteName, ref };
  },
  head: ({ loaderData }) =>
    loaderData ? buildAdminHead(loaderData.ref, loaderData.meta, loaderData.siteName) : {},
  component: RouteComponent,
});

const dateFormatter = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });

function RouteComponent() {
  const { layout, meta, ref } = Route.useLoaderData();
  return (
    <AdminCmsPage pageRef={ref} layout={layout} meta={meta}>
      <TenantsList />
    </AdminCmsPage>
  );
}

function TenantsList() {
  const content = useIntlayer("adminTenants");
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const qc = useQueryClient();

  const status: TenantStatus = search.filter?.status ?? "active";
  const showingDeleted = status === "deleted";

  // Local search input with debounce, initialized from the URL so bookmarks work.
  const [inputValue, setInputValue] = useState(search.filter?.search ?? "");
  const debouncedSearch = useDebouncedValue(inputValue, 300);
  const urlSearchRef = useRef(search.filter?.search);
  urlSearchRef.current = search.filter?.search;

  useEffect(() => {
    const next = debouncedSearch.trim() || undefined;
    if (next === (urlSearchRef.current || undefined)) return;
    navigate({
      search: (prev) => ({
        ...prev,
        filter: { ...prev.filter, search: next },
        page: { ...prev.page, number: 1 },
      }),
      replace: true,
    });
  }, [debouncedSearch, navigate]);

  function setStatus(nextStatus: TenantStatus) {
    navigate({
      search: (prev) => ({
        ...prev,
        filter: { ...prev.filter, status: nextStatus },
        page: { ...prev.page, number: 1 },
      }),
      replace: true,
    });
  }

  // Create form, in a dialog (active view only).
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const createMutation = useMutation(tenantsRepo.create(qc));

  function handleCreateOpenChange(next: boolean) {
    if (next) setNewName("");
    setCreateOpen(next);
  }

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (!name || createMutation.isPending) return;
    createMutation.mutate(
      { name },
      {
        onSuccess: (tenant) => {
          setNewName("");
          setCreateOpen(false);
          toast.success(`${content.created.value}: ${tenant.name}`);
        },
        onError: (err) => {
          toast.error(content.createFailed.value, {
            description: err instanceof Error ? err.message : undefined,
          });
        },
      },
    );
  }

  const sorting: SortingState = [
    { id: search.sort.replace(/^-/, ""), desc: search.sort.startsWith("-") },
  ];

  function handleSortingChange(updater: Updater<SortingState>) {
    const next = typeof updater === "function" ? updater(sorting) : updater;
    const sort = next[0];
    const field = sort?.id ?? "name";
    const sortValue = (sort?.desc ? `-${field}` : field) as SortValue;
    navigate({
      search: (prev) => ({ ...prev, sort: sortValue, page: { ...prev.page, number: 1 } }),
      replace: true,
    });
  }

  const columns = useMemo<ColumnDef<SafeTenant>[]>(() => {
    const base: ColumnDef<SafeTenant>[] = [
      {
        accessorKey: "name",
        header: content.colName.value,
        cell: ({ row }) => (
          <Link to="/{-$locale}/admin/tenants/$tenantId" params={{ tenantId: row.original.id }}>
            {row.original.name}
          </Link>
        ),
      },
      {
        accessorKey: "created",
        header: content.colCreated.value,
        cell: ({ row }) => dateFormatter.format(new Date(row.original.created)),
      },
    ];
    if (showingDeleted) {
      base.push({
        accessorKey: "deleted",
        header: content.colDeleted.value,
        enableSorting: false,
        cell: ({ row }) =>
          row.original.deleted ? dateFormatter.format(new Date(row.original.deleted)) : "—",
      });
    }
    return base;
  }, [content, showingDeleted]);

  const { data, isFetching } = useQuery({
    ...tenantsRepo.list(toListParams(search)),
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
    navigate({ search: (prev) => ({ ...prev, page: { number: 1, size } }), replace: true });
  }

  const pageNumber = search.page.number;
  const pageSize = search.page.size;
  const pageCount = meta?.pageCount ?? 1;
  const totalCount = meta?.totalCount ?? 0;
  const firstItem = totalCount === 0 ? 0 : (pageNumber - 1) * pageSize + 1;
  const lastItem = Math.min(pageNumber * pageSize, totalCount);

  return (
    <section className="full">
      <h1>{content.title}</h1>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "1rem",
          marginBlock: "1rem",
          flexWrap: "wrap",
        }}
      >
        <Input
          type="search"
          placeholder={content.searchPlaceholder.value}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          style={{ maxWidth: "20rem" }}
        />

        {!showingDeleted && (
          <Dialog open={createOpen} onOpenChange={handleCreateOpenChange}>
            <DialogTrigger
              render={
                <Button intent="primary" style={{ gap: "var(--spacing-xs)" }}>
                  <AddIcon aria-hidden="true" />
                  {content.add}
                </Button>
              }
            />
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{content.addTitle}</DialogTitle>
              </DialogHeader>
              <form
                onSubmit={handleCreate}
                style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-lg)" }}
              >
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="new-tenant-name">{content.nameLabel}</FieldLabel>
                    <FieldBody>
                      <Input
                        id="new-tenant-name"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        placeholder={content.newNamePlaceholder.value}
                        maxLength={80}
                        autoFocus
                      />
                    </FieldBody>
                  </Field>
                </FieldGroup>
                <DialogFooter>
                  <DialogClose render={<Button type="button" variant="outline" />}>
                    {content.cancel}
                  </DialogClose>
                  <Button
                    type="submit"
                    intent="primary"
                    disabled={!newName.trim() || createMutation.isPending}
                  >
                    {createMutation.isPending ? content.adding : content.submit}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Tabs value={status} onValueChange={(value) => setStatus(value as TenantStatus)}>
        <TabsList variant="line" style={{ marginBlockEnd: "1rem" }}>
          <TabsTrigger value="active">{content.statusActive}</TabsTrigger>
          <TabsTrigger value="deleted">{content.statusDeleted}</TabsTrigger>
        </TabsList>
      </Tabs>

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
              <TableCell colSpan={columns.length}>{content.noTenants}</TableCell>
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
              {firstItem}–{lastItem} {content.of} {totalCount} {content.tenants}
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
