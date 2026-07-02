import { useState } from "react";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useIntlayer } from "react-intlayer";
import { toast } from "sonner";
import type { TenantId } from "@/db/schema/tenants";
import { Button } from "@/components/ui/button";
import { Field, FieldBody, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { idParam } from "@/lib/shortId";
import { meQueryOptions } from "@/server/fns/auth";
import { tenantsRepo } from "@/repositories/tenants";

export const Route = createFileRoute("/{-$locale}/_authed/admin/tenants/$tenantId")({
  params: idParam("tenantId"),
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(tenantsRepo.byId(params.tenantId as TenantId)),
  component: RouteComponent,
});

function RouteComponent() {
  const { tenantId } = Route.useParams();
  const id = tenantId as TenantId;
  const qc = useQueryClient();
  const router = useRouter();
  const content = useIntlayer("adminTenantEdit");

  const { data: tenant } = useSuspenseQuery(tenantsRepo.byId(id));
  const { data: me } = useSuspenseQuery(meQueryOptions());
  const isAdmin = me?.roles.includes("admin") ?? false;
  const isDeleted = tenant.deleted != null;

  const [name, setName] = useState(tenant.name);
  const trimmed = name.trim();
  const dirty = trimmed !== tenant.name;

  const updateMutation = useMutation(tenantsRepo.update(qc));
  const softDeleteMutation = useMutation(tenantsRepo.softDelete(qc));
  const restoreMutation = useMutation(tenantsRepo.restore(qc));
  const permanentDeleteMutation = useMutation(tenantsRepo.permanentDelete(qc));

  const busy =
    updateMutation.isPending ||
    softDeleteMutation.isPending ||
    restoreMutation.isPending ||
    permanentDeleteMutation.isPending;

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!trimmed || !dirty || busy) return;
    updateMutation.mutate(
      { id, patch: { name: trimmed } },
      {
        onSuccess: (updated) => toast.success(`${content.saved.value}: ${updated.name}`),
        onError: (err) =>
          toast.error(content.updateFailed.value, {
            description: err instanceof Error ? err.message : undefined,
          }),
      },
    );
  }

  function handleSoftDelete() {
    if (busy) return;
    softDeleteMutation.mutate(id, {
      onSuccess: () => toast.success(content.deleted.value),
      onError: (err) =>
        toast.error(content.actionFailed.value, {
          description: err instanceof Error ? err.message : undefined,
        }),
    });
  }

  function handleRestore() {
    if (busy) return;
    restoreMutation.mutate(id, {
      onSuccess: () => toast.success(content.restored.value),
      onError: (err) =>
        toast.error(content.actionFailed.value, {
          description: err instanceof Error ? err.message : undefined,
        }),
    });
  }

  function handlePermanentDelete() {
    if (busy) return;
    if (!window.confirm(content.confirmPermanent.value)) return;
    permanentDeleteMutation.mutate(id, {
      onSuccess: () => {
        toast.success(content.permanentDeleted.value);
        router.navigate({ to: "/{-$locale}/admin/tenants" });
      },
      onError: (err) =>
        toast.error(content.actionFailed.value, {
          description: err instanceof Error ? err.message : undefined,
        }),
    });
  }

  return (
    <section className="full">
      <Link to="/{-$locale}/admin/tenants">{content.back}</Link>
      <h1>{tenant.name}</h1>

      {isDeleted && <p style={{ color: "var(--text-muted)" }}>{content.deletedNotice}</p>}

      <form onSubmit={handleSave} className="form">
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="tenant-name">{content.name}</FieldLabel>
            <FieldBody>
              <Input
                id="tenant-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={80}
                disabled={isDeleted || busy}
              />
              <FieldError errors={!trimmed ? [{ message: content.nameRequired.value }] : []} />
            </FieldBody>
          </Field>

          <Button type="submit" intent="primary" disabled={isDeleted || !dirty || !trimmed || busy}>
            {updateMutation.isPending ? content.saving : content.save}
          </Button>
        </FieldGroup>
      </form>

      <div style={{ display: "flex", gap: "0.5rem", marginBlockStart: "1.5rem" }}>
        {!isDeleted ? (
          <Button variant="outline" onClick={handleSoftDelete} disabled={busy}>
            {softDeleteMutation.isPending ? content.deleting : content.delete}
          </Button>
        ) : (
          <>
            <Button variant="outline" onClick={handleRestore} disabled={busy}>
              {restoreMutation.isPending ? content.restoring : content.restore}
            </Button>
            {isAdmin && (
              <Button intent="danger" onClick={handlePermanentDelete} disabled={busy}>
                {permanentDeleteMutation.isPending
                  ? content.permanentDeleting
                  : content.permanentDelete}
              </Button>
            )}
          </>
        )}
      </div>
    </section>
  );
}
