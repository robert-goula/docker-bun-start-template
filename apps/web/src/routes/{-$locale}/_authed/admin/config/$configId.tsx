import { type FormEvent, useState } from "react";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useIntlayer } from "react-intlayer";
import { toast } from "sonner";
import AdminCmsPage from "@/components/AdminCmsPage";
import { Button } from "@/components/ui/button";
import { Field, FieldBody, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { ConfigId } from "@/db/schema/config";
import { buildAdminHead, loadAdminPage } from "@/lib/loadPage";
import { configRepo } from "@/repositories/config";

const PAGE_SLUG = "/admin/config";

export const Route = createFileRoute("/{-$locale}/_authed/admin/config/$configId")({
  loader: async ({ context, params }) => {
    const ref = { slug: PAGE_SLUG, locale: context.i18n.locale };
    const [{ layout: pageLayout, meta, siteName }] = await Promise.all([
      loadAdminPage(context.queryClient, ref),
      context.queryClient.ensureQueryData(configRepo.byId(params.configId as ConfigId)),
    ]);
    return { pageLayout, meta, siteName, ref };
  },
  head: ({ loaderData }) =>
    loaderData ? buildAdminHead(loaderData.ref, loaderData.meta, loaderData.siteName) : {},
  component: RouteComponent,
});

function RouteComponent() {
  const { pageLayout, meta, ref } = Route.useLoaderData();
  return (
    <AdminCmsPage pageRef={ref} layout={pageLayout} meta={meta}>
      <ConfigDetail />
    </AdminCmsPage>
  );
}

function ConfigDetail() {
  const content = useIntlayer("adminConfig");
  const { configId } = Route.useParams();
  const id = configId as ConfigId;
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: config } = useSuspenseQuery(configRepo.byId(id));

  // Seed local state once from the loader. The value is edited as pretty-printed JSON.
  const [description, setDescription] = useState(config.description ?? "");
  const [valueText, setValueText] = useState(() => JSON.stringify(config.value, null, 2));

  const setMutation = useMutation(configRepo.set(qc));
  const removeMutation = useMutation(configRepo.remove(qc));

  async function handleSave(e: FormEvent) {
    e.preventDefault();

    let value: unknown;
    try {
      value = JSON.parse(valueText);
    } catch {
      toast.error(content.notValidJson.value);
      return;
    }

    try {
      const saved = await setMutation.mutateAsync({
        id,
        value,
        description: description.trim() || null,
      });
      // Re-baseline the editor from the persisted value so formatting matches what's stored.
      setValueText(JSON.stringify(saved.value, null, 2));
      toast.success(content.savedToast.value);
    } catch (err) {
      toast.error(content.saveError.value, {
        description: err instanceof Error ? err.message : content.tryAgain.value,
      });
    }
  }

  async function handleDelete() {
    if (!window.confirm(`${content.deletePrefix.value}${id}${content.deleteSuffix.value}`)) return;
    try {
      await removeMutation.mutateAsync(id);
      toast.success(content.deletedToast.value, { description: id });
      navigate({ to: "/{-$locale}/admin/config" });
    } catch (err) {
      toast.error(content.deleteError.value, {
        description: err instanceof Error ? err.message : content.tryAgain.value,
      });
    }
  }

  return (
    <>
      <section className="full">
        <p>
          <Link to="/{-$locale}/admin/config">{content.backToConfig}</Link>
        </p>
        <h1>{content.editConfig}</h1>

        <form onSubmit={handleSave} className="form">
          <FieldGroup>
            <Field className="full">
              <FieldLabel htmlFor="config-id">{content.keyLabel}</FieldLabel>
              <FieldBody>
                <Input id="config-id" value={id} readOnly disabled />
              </FieldBody>
            </Field>
            <Field className="full">
              <FieldLabel htmlFor="config-description">{content.descriptionLabel}</FieldLabel>
              <FieldBody>
                <Input
                  id="config-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={content.optional.value}
                />
              </FieldBody>
            </Field>
            <Field className="full">
              <FieldLabel htmlFor="config-value">{content.valueJson}</FieldLabel>
              <FieldBody>
                <Textarea
                  id="config-value"
                  value={valueText}
                  onChange={(e) => setValueText(e.target.value)}
                  rows={14}
                  spellCheck={false}
                />
              </FieldBody>
            </Field>
            <Button type="submit" intent="primary" disabled={setMutation.isPending}>
              {setMutation.isPending ? content.saving : content.save}
            </Button>
            <Button
              type="button"
              intent="danger"
              variant="outline"
              onClick={handleDelete}
              disabled={removeMutation.isPending}
            >
              {content.delete}
            </Button>
          </FieldGroup>
        </form>
      </section>
    </>
  );
}
