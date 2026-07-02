import { type FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useIntlayer } from "react-intlayer";
import { type ColumnDef, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { toast } from "sonner";
import { AddIcon } from "@/components/icons";
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
import { layoutsRepo } from "@/repositories/layouts";
import type { SafeLayout } from "@/server/fns/layouts";

const PAGE_SLUG = "/admin/layouts";

export const Route = createFileRoute("/{-$locale}/_authed/admin/layouts/")({
  loader: async ({ context }) => {
    const ref = { slug: PAGE_SLUG, locale: context.i18n.locale };
    const [{ layout, meta, siteName }] = await Promise.all([
      loadAdminPage(context.queryClient, ref),
      context.queryClient.ensureQueryData(layoutsRepo.list()),
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
      <LayoutsList />
    </AdminCmsPage>
  );
}

function LayoutsList() {
  const content = useIntlayer("adminLayouts");
  const { data = [] } = useQuery(layoutsRepo.list());

  const columns = useMemo<ColumnDef<SafeLayout>[]>(
    () => [
      {
        accessorKey: "name",
        header: content.colName.value,
        cell: ({ row }) => (
          <Link to="/{-$locale}/admin/layouts/$layoutId" params={{ layoutId: row.original.id }}>
            {row.original.name}
          </Link>
        ),
      },
      {
        accessorKey: "description",
        header: content.colDescription.value,
        cell: ({ row }) => row.original.description || "—",
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
                <TableCell colSpan={columns.length}>{content.noLayouts}</TableCell>
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

// Creating a layout seeds it with all four zones at their default arrangement; the
// admin then tweaks the zones on the edit page.
function CreateLayout() {
  const content = useIntlayer("adminLayouts");
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const createMutation = useMutation(layoutsRepo.create(qc));
  const [open, setOpen] = useState(false);

  function handleOpenChange(next: boolean) {
    if (next) {
      setName("");
      setDescription("");
    }
    setOpen(next);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      const created = await createMutation.mutateAsync({
        name: name.trim(),
        description: description.trim() || null,
      });
      setOpen(false);
      toast.success(content.createdToast.value, { description: created.name });
      navigate({ to: "/{-$locale}/admin/layouts/$layoutId", params: { layoutId: created.id } });
    } catch (err) {
      toast.error(content.createError.value, {
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
              {content.createLayout}
            </Button>
          }
        />
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{content.createLayout}</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={handleSubmit}
            style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-lg)" }}
          >
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="new-layout-name">{content.newLayoutName}</FieldLabel>
                <FieldBody>
                  <Input
                    id="new-layout-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Article"
                    autoFocus
                  />
                </FieldBody>
              </Field>
              <Field>
                <FieldLabel htmlFor="new-layout-description">{content.descriptionLabel}</FieldLabel>
                <FieldBody>
                  <Input
                    id="new-layout-description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder={content.optional.value}
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
                disabled={!name.trim() || createMutation.isPending}
              >
                {createMutation.isPending ? content.creating : content.createLayout}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
