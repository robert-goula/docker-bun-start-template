import { type FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useIntlayer } from "react-intlayer";
import { type ColumnDef, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import * as z from "zod";
import { type TaxonomyId } from "@/db/schema/taxonomy";
import { DEFAULT_LOCALE } from "@/db/schema/pages";
import AdminCmsPage from "@/components/AdminCmsPage";
import { AddIcon, DeleteIcon, EditIcon } from "@/components/icons";
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
import { IconButton } from "@/components/ui/iconButton";
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
import { buildAdminHead, loadAdminPage } from "@/lib/loadPage";
import { decodeIdParam, encodeId } from "@/lib/shortId";
import { taxonomyRepo, type SafeTaxonomy } from "@/repositories/taxonomy";
import { toast } from "sonner";

const PAGE_SLUG = "/admin/taxonomy";

// `parent` drives the drill-down: absent → roots (parentId IS NULL); a base58 id → that node's
// children. It's the short-uuid form (matching path-param ids) — decoded to the real uuid at the
// boundary with `decodeIdParam`. A bad value falls back to roots rather than erroring the page.
const taxonomySearchSchema = z.object({
  parent: z.string().optional().catch(undefined),
});

export const Route = createFileRoute("/{-$locale}/_authed/admin/taxonomy/")({
  validateSearch: taxonomySearchSchema,
  loaderDeps: ({ search }) => ({ parent: search.parent }),
  loader: async ({ context, deps }) => {
    const pid = (decodeIdParam(deps.parent) ?? null) as TaxonomyId | null;
    const ref = { slug: PAGE_SLUG, locale: context.i18n.locale };
    const [{ layout, meta, siteName }] = await Promise.all([
      loadAdminPage(context.queryClient, ref),
      context.queryClient.ensureQueryData(taxonomyRepo.byParent(pid)),
      pid
        ? context.queryClient.ensureQueryData(taxonomyRepo.byId(pid))
        : Promise.resolve(undefined),
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
      <TaxonomyList />
    </AdminCmsPage>
  );
}

function TaxonomyList() {
  const content = useIntlayer("adminTaxonomy");
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
      `${content.deletePrefix.value}${row.value}${content.deleteSuffix.value}`,
    );
    if (!ok) return;
    try {
      await removeMutation.mutateAsync(row.id as TaxonomyId);
      toast.success(`${content.deleted.value} "${row.value}"`);
    } catch (err) {
      toast.error(content.deleteError.value, {
        description: err instanceof Error ? err.message : content.tryAgain.value,
      });
    }
  }

  const columns = useMemo<ColumnDef<SafeTaxonomy>[]>(
    () => [
      {
        id: "label",
        header: `${content.colLabel.value} (${DEFAULT_LOCALE})`,
        // Default-locale display label — drilling into this node's children. The label lives in
        // `locales`, never assumed to equal the canonical `value`.
        cell: ({ row }) => (
          <Link to="/{-$locale}/admin/taxonomy" search={{ parent: encodeId(row.original.id) }}>
            {row.original.locales?.[DEFAULT_LOCALE] ?? "—"}
          </Link>
        ),
      },
      {
        accessorKey: "value",
        header: content.colValue.value,
        // The canonical, immutable value (e.g. a key or hex code) — not a label.
        cell: ({ row }) => <code>{row.original.value}</code>,
      },
      {
        accessorKey: "locales",
        header: content.colLocales.value,
        cell: ({ row }) => {
          const codes = Object.keys(row.original.locales ?? {});
          return codes.length ? codes.join(", ") : "—";
        },
      },
      {
        accessorKey: "sort",
        header: content.colSort.value,
        cell: ({ row }) => row.original.sort,
      },
      {
        accessorKey: "created",
        header: content.colCreated.value,
        cell: ({ row }) => dateFormatter.format(new Date(row.original.created)),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => {
          const name = row.original.locales?.[DEFAULT_LOCALE] ?? row.original.value;
          return (
            <span style={{ display: "inline-flex", gap: "0.5rem" }}>
              <IconButton
                aria-label={`${content.edit.value} ${name}`}
                onClick={() =>
                  navigate({
                    to: "/{-$locale}/admin/taxonomy/$taxonomyId",
                    params: { taxonomyId: row.original.id },
                  })
                }
              >
                <EditIcon />
              </IconButton>
              <IconButton
                tone="danger"
                aria-label={`${content.delete.value} ${name}`}
                onClick={() => handleDelete(row.original)}
                disabled={removeMutation.isPending}
              >
                <DeleteIcon />
              </IconButton>
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
      <h1>{content.title}</h1>

      {/* Breadcrumb: roots → current node. */}
      <nav style={{ marginBlockEnd: "1rem", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        <Link
          to="/{-$locale}/admin/taxonomy"
          search={{ parent: undefined }}
          className="breadcrumb-item"
        >
          {content.allTaxonomies}
        </Link>
        {parentId ? (
          <span className="breadcrumb-item">
            {current?.locales?.[DEFAULT_LOCALE] ?? current?.value ?? "…"}
          </span>
        ) : null}
      </nav>

      {parentId ? (
        <p style={{ marginBlockEnd: "1rem" }}>
          <Link
            to="/{-$locale}/admin/taxonomy"
            search={{ parent: current?.parentId ? encodeId(current.parentId) : undefined }}
          >
            {content.upOneLevel}
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
                {parentId ? content.noChild : content.noTaxonomies}
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
  const content = useIntlayer("adminTaxonomy");
  const qc = useQueryClient();
  // `value` is the canonical, immutable value; `label` is the default-locale display label.
  // They're stored independently — the label (incl. the default locale) always lives in `locales`.
  const [value, setValue] = useState("");
  const [label, setLabel] = useState("");
  const createMutation = useMutation(taxonomyRepo.create(qc));
  const [open, setOpen] = useState(false);

  const dialogTitle = parentId
    ? `${content.newTermUnder.value} “${parentLabel ?? "…"}”`
    : content.newRootTaxonomy.value;

  function handleOpenChange(next: boolean) {
    if (next) {
      setValue("");
      setLabel("");
    }
    setOpen(next);
  }

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
      setOpen(false);
      toast.success(
        `${content.added.value} "${created.locales?.[DEFAULT_LOCALE] ?? created.value}"`,
      );
      setValue("");
      setLabel("");
    } catch (err) {
      toast.error(content.addError.value, {
        description: err instanceof Error ? err.message : content.tryAgain.value,
      });
    }
  }

  return (
    <div style={{ display: "flex", justifyContent: "flex-end", marginBlockEnd: "1.5rem" }}>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogTrigger
          render={
            <Button intent="primary" style={{ gap: "var(--spacing-xs)" }}>
              <AddIcon aria-hidden="true" />
              {content.create}
            </Button>
          }
        />
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialogTitle}</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={handleSubmit}
            style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-lg)" }}
          >
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="new-taxonomy-value">{content.valueCanonical}</FieldLabel>
                <FieldBody>
                  <Input
                    id="new-taxonomy-value"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder={parentId ? "#ff0000" : "colors"}
                    autoFocus
                  />
                </FieldBody>
              </Field>
              <Field>
                <FieldLabel htmlFor="new-taxonomy-label">
                  {content.labelWord} ({DEFAULT_LOCALE})
                </FieldLabel>
                <FieldBody>
                  <Input
                    id="new-taxonomy-label"
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    placeholder={parentId ? "Red" : "Colors"}
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
                disabled={!value.trim() || createMutation.isPending}
              >
                {createMutation.isPending ? content.creating : content.create}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
