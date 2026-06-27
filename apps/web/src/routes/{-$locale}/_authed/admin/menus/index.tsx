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
import { loadAdminPage } from "@/lib/loadPage";
import { menusRepo } from "@/repositories/menus";
import type { SafeMenu } from "@/server/fns/menus";

const PAGE_SLUG = "/admin/menus";

export const Route = createFileRoute("/{-$locale}/_authed/admin/menus/")({
  loader: async ({ context }) => {
    const ref = { slug: PAGE_SLUG, locale: context.i18n.locale };
    const [layout] = await Promise.all([
      loadAdminPage(context.queryClient, ref),
      context.queryClient.ensureQueryData(menusRepo.list()),
    ]);
    return { layout, ref };
  },
  component: RouteComponent,
});

// Counts every node in a menu tree (top-level + nested).
const countItems = (items: SafeMenu["items"]): number =>
  items.reduce((sum, item) => sum + 1 + countItems(item.children), 0);

function RouteComponent() {
  const { layout, ref } = Route.useLoaderData();
  return (
    <AdminCmsPage pageRef={ref} layout={layout}>
      <MenusList />
    </AdminCmsPage>
  );
}

function MenusList() {
  const content = useIntlayer("adminMenus");
  const { data = [] } = useQuery(menusRepo.list());

  const columns = useMemo<ColumnDef<SafeMenu>[]>(
    () => [
      {
        accessorKey: "name",
        header: content.colName.value,
        cell: ({ row }) => (
          <Link to="/{-$locale}/admin/menus/$menuId" params={{ menuId: row.original.id }}>
            {row.original.name}
          </Link>
        ),
      },
      {
        accessorKey: "slug",
        header: content.colSlug.value,
        cell: ({ row }) => row.original.slug,
      },
      {
        accessorKey: "items",
        header: content.colItems.value,
        cell: ({ row }) => countItems(row.original.items),
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
        <CreateMenu />
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
                <TableCell colSpan={columns.length}>{content.noMenus}</TableCell>
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

// Creating a menu starts it empty; the admin builds the tree on the edit page.
function CreateMenu() {
  const content = useIntlayer("adminMenus");
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const createMutation = useMutation(menusRepo.create(qc));

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      const created = await createMutation.mutateAsync({
        name: name.trim(),
        description: description.trim() || null,
      });
      toast.success(content.createdToast.value, { description: created.name });
      navigate({ to: "/{-$locale}/admin/menus/$menuId", params: { menuId: created.id } });
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
          <FieldLabel htmlFor="new-menu-name">{content.newMenuName}</FieldLabel>
          <FieldBody>
            <Input
              id="new-menu-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Main navigation"
            />
          </FieldBody>
        </Field>
        <Field className="½">
          <FieldLabel htmlFor="new-menu-description">{content.descriptionLabel}</FieldLabel>
          <FieldBody>
            <Input
              id="new-menu-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={content.optional.value}
            />
          </FieldBody>
        </Field>
        <Button type="submit" intent="primary" disabled={!name.trim() || createMutation.isPending}>
          {createMutation.isPending ? content.creating : content.createMenu}
        </Button>
      </FieldGroup>
    </form>
  );
}
