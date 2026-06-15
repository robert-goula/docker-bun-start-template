import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { type ColumnDef, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { DEFAULT_LOCALE } from "@/db/schema/pages";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { pagesRepo } from "@/repositories/pages";
import type { SafePageListItem } from "@/server/fns/pages";

export const Route = createFileRoute("/_authed/admin/pages/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(pagesRepo.list()),
  component: RouteComponent,
});

const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

// Pages are stored with a pathname slug (e.g. "/about"); the public URL prefixes
// a non-default locale segment.
function pageHref({ slug, locale }: SafePageListItem) {
  if (locale === DEFAULT_LOCALE) return slug;
  return `/${locale}${slug === "/" ? "" : slug}`;
}

function byline(name: string | null, at: Date | null) {
  if (!at) return "—";
  return (
    <span style={{ display: "inline-flex", flexDirection: "column" }}>
      <span>{name ?? "Unknown"}</span>
      <span style={{ color: "var(--muted-foreground)", fontSize: "0.85em" }}>
        {dateTimeFormatter.format(new Date(at))}
      </span>
    </span>
  );
}

const columns: ColumnDef<SafePageListItem>[] = [
  {
    accessorKey: "title",
    header: "Title",
    cell: ({ row }) => <a href={pageHref(row.original)}>{row.original.title}</a>,
  },
  {
    accessorKey: "slug",
    header: "Slug",
    cell: ({ row }) => (
      <code>
        {row.original.slug}
        {row.original.locale !== DEFAULT_LOCALE ? ` (${row.original.locale})` : ""}
      </code>
    ),
  },
  {
    accessorKey: "layoutName",
    header: "Layout",
  },
  {
    id: "createdBy",
    header: "Created",
    cell: ({ row }) => byline(row.original.createdByName, row.original.created),
  },
  {
    id: "updatedBy",
    header: "Last edited",
    cell: ({ row }) => byline(row.original.updatedByName, row.original.updated),
  },
];

function RouteComponent() {
  const { data = [] } = useQuery(pagesRepo.list());

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <main className="zone">
      <section className="full">
        <h1>Pages</h1>
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length}>No pages yet.</TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
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
      </section>
    </main>
  );
}
