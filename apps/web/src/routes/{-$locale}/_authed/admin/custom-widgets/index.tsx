import { type FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useIntlayer } from "react-intlayer";
import { type ColumnDef, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
import AdminCmsPage from "@/components/AdminCmsPage";
import { buildAdminHead, loadAdminPage } from "@/lib/loadPage";
import { customWidgetsRepo } from "@/repositories/customWidgets";
import type { SafeCustomWidget } from "@/server/fns/customWidgets";

const PAGE_SLUG = "/admin/custom-widgets";

export const Route = createFileRoute("/{-$locale}/_authed/admin/custom-widgets/")({
  loader: async ({ context }) => {
    const ref = { slug: PAGE_SLUG, locale: context.i18n.locale };
    const [{ layout, meta, siteName }] = await Promise.all([
      loadAdminPage(context.queryClient, ref),
      context.queryClient.ensureQueryData(customWidgetsRepo.list()),
    ]);
    return { layout, meta, siteName, ref };
  },
  head: ({ loaderData }) =>
    loaderData ? buildAdminHead(loaderData.ref, loaderData.meta, loaderData.siteName) : {},
  component: RouteComponent,
});

function RouteComponent() {
  const { layout, meta, ref } = Route.useLoaderData();
  return (
    <AdminCmsPage pageRef={ref} layout={layout} meta={meta}>
      <CustomWidgetsList />
    </AdminCmsPage>
  );
}

function CustomWidgetsList() {
  const content = useIntlayer("adminCustomWidgets");
  const { data = [] } = useQuery(customWidgetsRepo.list());

  const columns = useMemo<ColumnDef<SafeCustomWidget>[]>(
    () => [
      {
        accessorKey: "name",
        header: content.colName.value,
        cell: ({ row }) => (
          <Link
            to="/{-$locale}/admin/custom-widgets/$widgetId"
            params={{ widgetId: row.original.id }}
          >
            {row.original.name}
          </Link>
        ),
      },
      {
        accessorKey: "fields",
        header: content.colFields.value,
        cell: ({ row }) => row.original.fields.length,
      },
      {
        accessorKey: "description",
        header: content.colDescription.value,
        cell: ({ row }) => row.original.description || "—",
      },
    ],
    [content],
  );

  const table = useReactTable({ data, columns, getCoreRowModel: getCoreRowModel() });

  return (
    <>
      <section className="full">
        <h1>{content.title}</h1>
        <CreateCustomWidget />
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
                <TableCell colSpan={columns.length}>{content.noWidgets}</TableCell>
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
      </section>
    </>
  );
}

// Creating a definition starts it with no fields; the admin adds fields on the edit page.
function CreateCustomWidget() {
  const content = useIntlayer("adminCustomWidgets");
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const createMutation = useMutation(customWidgetsRepo.create(qc));

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      const created = await createMutation.mutateAsync({
        name: name.trim(),
        description: description.trim() || null,
      });
      toast.success(content.createdToast.value, { description: created.name });
      navigate({
        to: "/{-$locale}/admin/custom-widgets/$widgetId",
        params: { widgetId: created.id },
      });
    } catch (err) {
      toast.error(content.createError.value, {
        description: err instanceof Error ? err.message : content.tryAgain.value,
      });
    }
  }

  return (
    <form onSubmit={handleSubmit} className="form" style={{ marginBlockEnd: "1.5rem" }}>
      <FieldGroup>
        <Field className="½">
          <FieldLabel htmlFor="new-cw-name">{content.newWidgetName}</FieldLabel>
          <FieldBody>
            <Input
              id="new-cw-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Headline"
            />
          </FieldBody>
        </Field>
        <Field className="½">
          <FieldLabel htmlFor="new-cw-description">{content.descriptionLabel}</FieldLabel>
          <FieldBody>
            <Input
              id="new-cw-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={content.optional.value}
            />
          </FieldBody>
        </Field>
        <Button type="submit" intent="primary" disabled={!name.trim() || createMutation.isPending}>
          {createMutation.isPending ? content.creating : content.createWidget}
        </Button>
      </FieldGroup>
    </form>
  );
}
