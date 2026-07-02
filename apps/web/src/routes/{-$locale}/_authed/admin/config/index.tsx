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
import { Textarea } from "@/components/ui/textarea";
import AdminCmsPage from "@/components/AdminCmsPage";
import { insertConfigSchema } from "@/db/schema/config";
import { buildAdminHead, loadAdminPage } from "@/lib/loadPage";
import { configRepo } from "@/repositories/config";
import type { SafeConfig } from "@/server/fns/config";

const PAGE_SLUG = "/admin/config";

export const Route = createFileRoute("/{-$locale}/_authed/admin/config/")({
  loader: async ({ context }) => {
    const ref = { slug: PAGE_SLUG, locale: context.i18n.locale };
    const [{ layout, meta, siteName }] = await Promise.all([
      loadAdminPage(context.queryClient, ref),
      context.queryClient.ensureQueryData(configRepo.list()),
    ]);
    return { layout, meta, siteName, ref };
  },
  head: ({ loaderData }) =>
    loaderData ? buildAdminHead(loaderData.ref, loaderData.meta, loaderData.siteName) : {},
  component: RouteComponent,
});

// One-line preview of a value for the table (objects/arrays shown as compact JSON).
const preview = (value: unknown) => {
  const json = JSON.stringify(value);
  return json.length > 80 ? `${json.slice(0, 79)}…` : json;
};

function RouteComponent() {
  const { layout, meta, ref } = Route.useLoaderData();
  return (
    <AdminCmsPage pageRef={ref} layout={layout} meta={meta}>
      <ConfigList />
    </AdminCmsPage>
  );
}

function ConfigList() {
  const content = useIntlayer("adminConfig");
  const { data = [] } = useQuery(configRepo.list());

  const columns = useMemo<ColumnDef<SafeConfig>[]>(
    () => [
      {
        accessorKey: "id",
        header: content.colKey.value,
        cell: ({ row }) => (
          <Link to="/{-$locale}/admin/config/$configId" params={{ configId: row.original.id }}>
            {row.original.id}
          </Link>
        ),
      },
      {
        accessorKey: "value",
        header: content.colValue.value,
        cell: ({ row }) => <code>{preview(row.original.value)}</code>,
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
                <TableCell colSpan={columns.length}>{content.noConfig}</TableCell>
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
  const content = useIntlayer("adminConfig");
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [id, setId] = useState("");
  const [description, setDescription] = useState("");
  const [valueText, setValueText] = useState("null");
  const setMutation = useMutation(configRepo.set(qc));
  const [open, setOpen] = useState(false);

  function handleOpenChange(next: boolean) {
    if (next) {
      setId("");
      setDescription("");
      setValueText("null");
    }
    setOpen(next);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    const parsedId = insertConfigSchema.shape.id.safeParse(id.trim());
    if (!parsedId.success) {
      toast.error(content.invalidKey.value, {
        description: parsedId.error.issues[0]?.message ?? content.invalidKeyHint.value,
      });
      return;
    }

    let value: unknown;
    try {
      value = JSON.parse(valueText);
    } catch {
      toast.error(content.notValidJson.value);
      return;
    }

    try {
      const saved = await setMutation.mutateAsync({
        id: parsedId.data,
        value,
        description: description.trim() || null,
      });
      setOpen(false);
      toast.success(content.savedToast.value, { description: saved.id });
      navigate({ to: "/{-$locale}/admin/config/$configId", params: { configId: saved.id } });
    } catch (err) {
      toast.error(content.saveError.value, {
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
              {content.createConfig}
            </Button>
          }
        />
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{content.createConfig}</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={handleSubmit}
            style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-lg)" }}
          >
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="new-config-id">{content.newKey}</FieldLabel>
                <FieldBody>
                  <Input
                    id="new-config-id"
                    value={id}
                    onChange={(e) => setId(e.target.value)}
                    placeholder="plugins.enabled"
                    autoFocus
                  />
                </FieldBody>
              </Field>
              <Field>
                <FieldLabel htmlFor="new-config-description">{content.descriptionLabel}</FieldLabel>
                <FieldBody>
                  <Input
                    id="new-config-description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder={content.optional.value}
                  />
                </FieldBody>
              </Field>
              <Field>
                <FieldLabel htmlFor="new-config-value">{content.valueJson}</FieldLabel>
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
            </FieldGroup>
            <DialogFooter>
              <DialogClose render={<Button type="button" variant="outline" />}>
                {content.cancel}
              </DialogClose>
              <Button type="submit" intent="primary" disabled={!id.trim() || setMutation.isPending}>
                {setMutation.isPending ? content.saving : content.createConfig}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
