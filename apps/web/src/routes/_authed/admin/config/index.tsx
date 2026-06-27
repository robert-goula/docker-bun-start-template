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
import { Textarea } from "@/components/ui/textarea";
import { insertConfigSchema } from "@/db/schema/config";
import { configRepo } from "@/repositories/config";
import type { SafeConfig } from "@/server/fns/config";

export const Route = createFileRoute("/_authed/admin/config/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(configRepo.list()),
  component: RouteComponent,
});

// One-line preview of a value for the table (objects/arrays shown as compact JSON).
const preview = (value: unknown) => {
  const json = JSON.stringify(value);
  return json.length > 80 ? `${json.slice(0, 79)}…` : json;
};

const columns: ColumnDef<SafeConfig>[] = [
  {
    accessorKey: "id",
    header: "Key",
    cell: ({ row }) => (
      <Link to="/admin/config/$configId" params={{ configId: row.original.id }}>
        {row.original.id}
      </Link>
    ),
  },
  {
    accessorKey: "value",
    header: "Value",
    cell: ({ row }) => <code>{preview(row.original.value)}</code>,
  },
  {
    accessorKey: "description",
    header: "Description",
    cell: ({ row }) => row.original.description || "—",
  },
];

function RouteComponent() {
  const { data = [] } = useQuery(configRepo.list());

  const table = useReactTable({ data, columns, getCoreRowModel: getCoreRowModel() });

  return (
    <>
      <section className="full">
        <h1>Config</h1>
        <CreateConfig />
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
                <TableCell colSpan={columns.length}>No config entries yet.</TableCell>
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

// Creates (upserts) a config entry. The id is namespaced dotted notation; the value is entered
// as JSON. Known keys are validated server-side against the registry.
function CreateConfig() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [id, setId] = useState("");
  const [description, setDescription] = useState("");
  const [valueText, setValueText] = useState("null");
  const setMutation = useMutation(configRepo.set(qc));

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    const parsedId = insertConfigSchema.shape.id.safeParse(id.trim());
    if (!parsedId.success) {
      toast.error("Invalid key", {
        description:
          parsedId.error.issues[0]?.message ?? "Use dotted notation, e.g. plugins.enabled",
      });
      return;
    }

    let value: unknown;
    try {
      value = JSON.parse(valueText);
    } catch {
      toast.error("Value is not valid JSON");
      return;
    }

    try {
      const saved = await setMutation.mutateAsync({
        id: parsedId.data,
        value,
        description: description.trim() || null,
      });
      toast.success(`Config "${saved.id}" saved`);
      navigate({ to: "/admin/config/$configId", params: { configId: saved.id } });
    } catch (err) {
      toast.error("Couldn’t save config", {
        description: err instanceof Error ? err.message : "Please try again.",
      });
    }
  }

  return (
    <form onSubmit={handleSubmit} className="form" style={{ marginBlockEnd: "1.5rem" }}>
      <FieldGroup>
        <Field className="½">
          <FieldLabel htmlFor="new-config-id">New key</FieldLabel>
          <FieldBody>
            <Input
              id="new-config-id"
              value={id}
              onChange={(e) => setId(e.target.value)}
              placeholder="plugins.enabled"
            />
          </FieldBody>
        </Field>
        <Field className="½">
          <FieldLabel htmlFor="new-config-description">Description</FieldLabel>
          <FieldBody>
            <Input
              id="new-config-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional"
            />
          </FieldBody>
        </Field>
        <Field className="full">
          <FieldLabel htmlFor="new-config-value">Value (JSON)</FieldLabel>
          <FieldBody>
            <Textarea
              id="new-config-value"
              value={valueText}
              onChange={(e) => setValueText(e.target.value)}
              rows={4}
              spellCheck={false}
            />
          </FieldBody>
        </Field>
        <Button type="submit" intent="primary" disabled={!id.trim() || setMutation.isPending}>
          {setMutation.isPending ? "Saving…" : "Create config"}
        </Button>
      </FieldGroup>
    </form>
  );
}
