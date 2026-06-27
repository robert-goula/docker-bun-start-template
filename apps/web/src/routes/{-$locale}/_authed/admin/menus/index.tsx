import { type FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
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
import { menusRepo } from "@/repositories/menus";
import type { SafeMenu } from "@/server/fns/menus";

export const Route = createFileRoute("/{-$locale}/_authed/admin/menus/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(menusRepo.list()),
  component: RouteComponent,
});

// Counts every node in a menu tree (top-level + nested).
const countItems = (items: SafeMenu["items"]): number =>
  items.reduce((sum, item) => sum + 1 + countItems(item.children), 0);

const columns: ColumnDef<SafeMenu>[] = [
  {
    accessorKey: "name",
    header: "Name",
    cell: ({ row }) => (
      <Link to="/{-$locale}/admin/menus/$menuId" params={{ menuId: row.original.id }}>
        {row.original.name}
      </Link>
    ),
  },
  {
    accessorKey: "slug",
    header: "Slug",
    cell: ({ row }) => row.original.slug,
  },
  {
    accessorKey: "items",
    header: "Items",
    cell: ({ row }) => countItems(row.original.items),
  },
  {
    accessorKey: "description",
    header: "Description",
    cell: ({ row }) => row.original.description || "—",
  },
];

function RouteComponent() {
  const { data = [] } = useQuery(menusRepo.list());

  const table = useReactTable({ data, columns, getCoreRowModel: getCoreRowModel() });

  return (
    <>
      <section className="full">
        <h1>Menus</h1>
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
                <TableCell colSpan={columns.length}>No menus yet.</TableCell>
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
      toast.success(`Menu "${created.name}" created`);
      navigate({ to: "/{-$locale}/admin/menus/$menuId", params: { menuId: created.id } });
    } catch (err) {
      toast.error("Couldn’t create menu", {
        description: err instanceof Error ? err.message : "Please try again.",
      });
    }
  }

  return (
    <form onSubmit={handleSubmit} className="form" style={{ marginBlockEnd: "1.5rem" }}>
      <FieldGroup>
        <Field className="½">
          <FieldLabel htmlFor="new-menu-name">New menu name</FieldLabel>
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
          <FieldLabel htmlFor="new-menu-description">Description</FieldLabel>
          <FieldBody>
            <Input
              id="new-menu-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional"
            />
          </FieldBody>
        </Field>
        <Button type="submit" intent="primary" disabled={!name.trim() || createMutation.isPending}>
          {createMutation.isPending ? "Creating…" : "Create menu"}
        </Button>
      </FieldGroup>
    </form>
  );
}
