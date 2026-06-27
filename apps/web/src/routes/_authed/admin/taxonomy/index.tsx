import { type FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { type ColumnDef, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import * as z from "zod";
import { type TaxonomyId } from "@/db/schema/taxonomy";
import { DEFAULT_LOCALE } from "@/db/schema/pages";
import { DeleteIcon, EditIcon } from "@/components/icons";
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
import { decodeIdParam, encodeId } from "@/lib/shortId";
import { taxonomyRepo, type SafeTaxonomy } from "@/repositories/taxonomy";
import { toast } from "sonner";

// `parent` drives the drill-down: absent → roots (parentId IS NULL); a base58 id → that node's
// children. It's the short-uuid form (matching path-param ids) — decoded to the real uuid at the
// boundary with `decodeIdParam`. A bad value falls back to roots rather than erroring the page.
const taxonomySearchSchema = z.object({
  parent: z.string().optional().catch(undefined),
});

export const Route = createFileRoute("/_authed/admin/taxonomy/")({
  validateSearch: taxonomySearchSchema,
  loaderDeps: ({ search }) => ({ parent: search.parent }),
  loader: ({ context, deps }) => {
    const pid = (decodeIdParam(deps.parent) ?? null) as TaxonomyId | null;
    return Promise.all([
      context.queryClient.ensureQueryData(taxonomyRepo.byParent(pid)),
      pid
        ? context.queryClient.ensureQueryData(taxonomyRepo.byId(pid))
        : Promise.resolve(undefined),
    ]);
  },
  component: RouteComponent,
});

const dateFormatter = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });

function RouteComponent() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const qc = useQueryClient();
  // The URL carries the base58 id; decode to the real uuid for repos/queries.
  const parentId = (decodeIdParam(search.parent) ?? null) as TaxonomyId | null;

  const { data: children = [] } = useQuery(taxonomyRepo.byParent(parentId));
  // The node we've drilled into — for the heading, breadcrumb, and "up one level" link.
  const { data: current } = useQuery({
    ...taxonomyRepo.byId(parentId as TaxonomyId),
    enabled: !!parentId,
  });

  const removeMutation = useMutation(taxonomyRepo.remove(qc));

  async function handleDelete(row: SafeTaxonomy) {
    const ok = window.confirm(
      `Delete "${row.value}" and all of its descendant taxonomies? This cannot be undone.`,
    );
    if (!ok) return;
    try {
      await removeMutation.mutateAsync(row.id as TaxonomyId);
      toast.success(`Deleted "${row.value}"`);
    } catch (err) {
      toast.error("Couldn’t delete taxonomy", {
        description: err instanceof Error ? err.message : "Please try again.",
      });
    }
  }

  const columns = useMemo<ColumnDef<SafeTaxonomy>[]>(
    () => [
      {
        id: "label",
        header: `Label (${DEFAULT_LOCALE})`,
        // Default-locale display label — drilling into this node's children. The label lives in
        // `locales`, never assumed to equal the canonical `value`.
        cell: ({ row }) => (
          <Link to="/admin/taxonomy" search={{ parent: encodeId(row.original.id) }}>
            {row.original.locales?.[DEFAULT_LOCALE] ?? "—"}
          </Link>
        ),
      },
      {
        accessorKey: "value",
        header: "Value",
        // The canonical, immutable value (e.g. a key or hex code) — not a label.
        cell: ({ row }) => <code>{row.original.value}</code>,
      },
      {
        accessorKey: "locales",
        header: "Locales",
        cell: ({ row }) => {
          const codes = Object.keys(row.original.locales ?? {});
          return codes.length ? codes.join(", ") : "—";
        },
      },
      {
        accessorKey: "sort",
        header: "Sort",
        cell: ({ row }) => row.original.sort,
      },
      {
        accessorKey: "created",
        header: "Created",
        cell: ({ row }) => dateFormatter.format(new Date(row.original.created)),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => {
          const name = row.original.locales?.[DEFAULT_LOCALE] ?? row.original.value;
          return (
            <span style={{ display: "inline-flex", gap: "0.5rem" }}>
              <Button
                size="sm"
                intent="primary"
                aria-label={`Edit ${name}`}
                onClick={() =>
                  navigate({
                    to: "/admin/taxonomy/$taxonomyId",
                    params: { taxonomyId: row.original.id },
                  })
                }
              >
                <EditIcon />
              </Button>
              <Button
                size="sm"
                intent="danger"
                aria-label={`Delete ${name}`}
                onClick={() => handleDelete(row.original)}
                disabled={removeMutation.isPending}
              >
                <DeleteIcon />
              </Button>
            </span>
          );
        },
      },
    ],
    // handleDelete/removeMutation are stable enough for this admin view.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [removeMutation.isPending],
  );

  const table = useReactTable({ data: children, columns, getCoreRowModel: getCoreRowModel() });

  return (
    <section className="full">
      <h1>Taxonomy</h1>

      {/* Breadcrumb: roots → current node. */}
      <nav style={{ marginBlockEnd: "1rem", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        <Link to="/admin/taxonomy" search={{ parent: undefined }}>
          All taxonomies
        </Link>
        {parentId ? (
          <>
            <span aria-hidden>»</span>
            <span>
              {current?.locales?.[DEFAULT_LOCALE] ?? current?.value ?? "…"}
            </span>
          </>
        ) : null}
      </nav>

      {parentId ? (
        <p style={{ marginBlockEnd: "1rem" }}>
          <Link
            to="/admin/taxonomy"
            search={{ parent: current?.parentId ? encodeId(current.parentId) : undefined }}
          >
            ← Up one level
          </Link>
        </p>
      ) : null}

      <CreateTaxonomy
        parentId={parentId}
        parentLabel={current?.locales?.[DEFAULT_LOCALE] ?? current?.value}
      />

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
              <TableCell colSpan={columns.length}>
                {parentId ? "No child taxonomies yet." : "No taxonomies yet."}
              </TableCell>
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
  );
}

// Creates a term at the current level (parentId = the node we've drilled into, or null at root).
function CreateTaxonomy({
  parentId,
  parentLabel,
}: {
  parentId: TaxonomyId | null;
  parentLabel?: string;
}) {
  const qc = useQueryClient();
  // `value` is the canonical, immutable value; `label` is the default-locale display label.
  // They're stored independently — the label (incl. the default locale) always lives in `locales`.
  const [value, setValue] = useState("");
  const [label, setLabel] = useState("");
  const createMutation = useMutation(taxonomyRepo.create(qc));

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmedValue = value.trim();
    if (!trimmedValue) return;
    // Always seed the default locale in `locales`; fall back to the value when no label is given.
    const trimmedLabel = label.trim() || trimmedValue;
    try {
      const created = await createMutation.mutateAsync({
        value: trimmedValue,
        parentId,
        locales: { [DEFAULT_LOCALE]: trimmedLabel },
      });
      toast.success(`Added "${created.locales?.[DEFAULT_LOCALE] ?? created.value}"`);
      setValue("");
      setLabel("");
    } catch (err) {
      toast.error("Couldn’t add taxonomy", {
        description: err instanceof Error ? err.message : "Please try again.",
      });
    }
  }

  return (
    <form onSubmit={handleSubmit} className="form" style={{ marginBlockEnd: "1.5rem" }}>
      <p style={{ marginBlockEnd: "0.5rem", color: "var(--text-muted)" }}>
        {parentId ? `New term under “${parentLabel ?? "…"}”` : "New root taxonomy"}
      </p>
      <FieldGroup>
        <Field className="½">
          <FieldLabel htmlFor="new-taxonomy-value">Value (canonical)</FieldLabel>
          <FieldBody>
            <Input
              id="new-taxonomy-value"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={parentId ? "#ff0000" : "colors"}
            />
          </FieldBody>
        </Field>
        <Field className="½">
          <FieldLabel htmlFor="new-taxonomy-label">Label ({DEFAULT_LOCALE})</FieldLabel>
          <FieldBody>
            <Input
              id="new-taxonomy-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={parentId ? "Red" : "Colors"}
            />
          </FieldBody>
        </Field>
        <Button type="submit" intent="primary" disabled={!value.trim() || createMutation.isPending}>
          {createMutation.isPending ? "Adding…" : "Add"}
        </Button>
      </FieldGroup>
    </form>
  );
}
