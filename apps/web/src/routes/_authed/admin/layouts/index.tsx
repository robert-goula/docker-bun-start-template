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
import { layoutsRepo } from "@/repositories/layouts";
import type { SafeLayout } from "@/server/fns/layouts";

export const Route = createFileRoute("/_authed/admin/layouts/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(layoutsRepo.list()),
  component: RouteComponent,
});

const dateFormatter = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });

const columns: ColumnDef<SafeLayout>[] = [
  {
    accessorKey: "name",
    header: "Name",
    cell: ({ row }) => (
      <Link to="/admin/layouts/$layoutId" params={{ layoutId: row.original.id }}>
        {row.original.name}
      </Link>
    ),
  },
  {
    accessorKey: "description",
    header: "Description",
    cell: ({ row }) => row.original.description || "—",
  },
  {
    accessorKey: "created",
    header: "Created",
    cell: ({ row }) => dateFormatter.format(new Date(row.original.created)),
  },
];

function RouteComponent() {
  const { data = [] } = useQuery(layoutsRepo.list());

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <main className="zone">
      <section className="full">
        <h1>Layouts</h1>
        <CreateLayout />
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
                <TableCell colSpan={columns.length}>No layouts yet.</TableCell>
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

// Creating a layout seeds it with all four zones at their default arrangement; the
// admin then tweaks the zones on the edit page.
function CreateLayout() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const createMutation = useMutation(layoutsRepo.create(qc));

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      const created = await createMutation.mutateAsync({
        name: name.trim(),
        description: description.trim() || null,
      });
      toast.success(`Layout "${created.name}" created`);
      navigate({ to: "/admin/layouts/$layoutId", params: { layoutId: created.id } });
    } catch (err) {
      toast.error("Couldn’t create layout", {
        description: err instanceof Error ? err.message : "Please try again.",
      });
    }
  }

  return (
    <form onSubmit={handleSubmit} className="form" style={{ marginBlockEnd: "1.5rem" }}>
      <FieldGroup>
        <Field className="½">
          <FieldLabel htmlFor="new-layout-name">New layout name</FieldLabel>
          <FieldBody>
            <Input
              id="new-layout-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Article"
            />
          </FieldBody>
        </Field>
        <Field className="½">
          <FieldLabel htmlFor="new-layout-description">Description</FieldLabel>
          <FieldBody>
            <Input
              id="new-layout-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional"
            />
          </FieldBody>
        </Field>
        <Button type="submit" intent="primary" disabled={!name.trim() || createMutation.isPending}>
          {createMutation.isPending ? "Creating…" : "Create layout"}
        </Button>
      </FieldGroup>
    </form>
  );
}
