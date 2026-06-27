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
import { customWidgetsRepo } from "@/repositories/customWidgets";
import type { SafeCustomWidget } from "@/server/fns/customWidgets";

export const Route = createFileRoute("/{-$locale}/_authed/admin/custom-widgets/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(customWidgetsRepo.list()),
  component: RouteComponent,
});

const columns: ColumnDef<SafeCustomWidget>[] = [
  {
    accessorKey: "name",
    header: "Name",
    cell: ({ row }) => (
      <Link to="/{-$locale}/admin/custom-widgets/$widgetId" params={{ widgetId: row.original.id }}>
        {row.original.name}
      </Link>
    ),
  },
  {
    accessorKey: "fields",
    header: "Fields",
    cell: ({ row }) => row.original.fields.length,
  },
  {
    accessorKey: "description",
    header: "Description",
    cell: ({ row }) => row.original.description || "—",
  },
];

function RouteComponent() {
  const { data = [] } = useQuery(customWidgetsRepo.list());

  const table = useReactTable({ data, columns, getCoreRowModel: getCoreRowModel() });

  return (
    <>
      <section className="full">
        <h1>Custom widgets</h1>
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
                <TableCell colSpan={columns.length}>No custom widgets yet.</TableCell>
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
      toast.success(`Custom widget "${created.name}" created`);
      navigate({ to: "/{-$locale}/admin/custom-widgets/$widgetId", params: { widgetId: created.id } });
    } catch (err) {
      toast.error("Couldn’t create custom widget", {
        description: err instanceof Error ? err.message : "Please try again.",
      });
    }
  }

  return (
    <form onSubmit={handleSubmit} className="form" style={{ marginBlockEnd: "1.5rem" }}>
      <FieldGroup>
        <Field className="½">
          <FieldLabel htmlFor="new-cw-name">New custom widget name</FieldLabel>
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
          <FieldLabel htmlFor="new-cw-description">Description</FieldLabel>
          <FieldBody>
            <Input
              id="new-cw-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional"
            />
          </FieldBody>
        </Field>
        <Button type="submit" intent="primary" disabled={!name.trim() || createMutation.isPending}>
          {createMutation.isPending ? "Creating…" : "Create custom widget"}
        </Button>
      </FieldGroup>
    </form>
  );
}
