import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useIntlayer } from "react-intlayer";
import { type ColumnDef, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import AdminCmsPage from "@/components/AdminCmsPage";
import { loadAdminPage } from "@/lib/loadPage";
import { zonesRepo } from "@/repositories/zones";
import type { SafeZone } from "@/server/fns/zones";

const PAGE_SLUG = "/admin/zones";

export const Route = createFileRoute("/{-$locale}/_authed/admin/zones/")({
  loader: async ({ context }) => {
    const ref = { slug: PAGE_SLUG, locale: context.i18n.locale };
    const [layout] = await Promise.all([
      loadAdminPage(context.queryClient, ref),
      context.queryClient.ensureQueryData(zonesRepo.list()),
    ]);
    return { layout, ref };
  },
  component: RouteComponent,
});

const dateFormatter = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });

function RouteComponent() {
  const { layout, ref } = Route.useLoaderData();
  return (
    <AdminCmsPage pageRef={ref} layout={layout}>
      <ZonesList />
    </AdminCmsPage>
  );
}

function ZonesList() {
  const content = useIntlayer("adminZones");
  const { data = [] } = useQuery(zonesRepo.list());

  const columns = useMemo<ColumnDef<SafeZone>[]>(
    () => [
      {
        accessorKey: "name",
        header: content.colName.value,
        cell: ({ row }) => row.original.name,
      },
      {
        accessorKey: "created",
        header: content.colCreated.value,
        cell: ({ row }) => dateFormatter.format(new Date(row.original.created)),
      },
    ],
    [content],
  );

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <>
      <section className="full">
        <h1>{content.title}</h1>
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
                <TableCell colSpan={columns.length}>{content.noZones}</TableCell>
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
    </>
  );
}
