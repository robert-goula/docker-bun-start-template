import { useState } from "react";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useIntlayer } from "react-intlayer";
import { toast } from "sonner";
import AdminCmsPage from "@/components/AdminCmsPage";
import CustomWidgetFieldsBuilder from "@/components/CustomWidgetFieldsBuilder";
import { Field, FieldBody, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  type CustomWidgetField,
  type CustomWidgetId,
  customWidgetFieldsSchema,
} from "@/db/schema/customWidgets";
import { type WidgetElement, widgetElements } from "@/db/schema/widgets";
import { loadAdminPage } from "@/lib/loadPage";
import { idParam } from "@/lib/shortId";
import { customWidgetsKeys, customWidgetsRepo } from "@/repositories/customWidgets";
import {
  type UpdateCustomWidgetAttributes,
  updateCustomWidgetFn,
} from "@/server/fns/customWidgets";
import s from "./$widgetId.module.css";

const PAGE_SLUG = "/admin/custom-widgets";

export const Route = createFileRoute("/{-$locale}/_authed/admin/custom-widgets/$widgetId")({
  params: idParam("widgetId"),
  loader: async ({ context, params }) => {
    const ref = { slug: PAGE_SLUG, locale: context.i18n.locale };
    const [pageLayout] = await Promise.all([
      loadAdminPage(context.queryClient, ref),
      context.queryClient.ensureQueryData(
        customWidgetsRepo.byId(params.widgetId as CustomWidgetId),
      ),
    ]);
    return { pageLayout, ref };
  },
  component: RouteComponent,
});

function RouteComponent() {
  const { pageLayout, ref } = Route.useLoaderData();
  return (
    <AdminCmsPage pageRef={ref} layout={pageLayout}>
      <CustomWidgetDetail />
    </AdminCmsPage>
  );
}

function CustomWidgetDetail() {
  const content = useIntlayer("adminCustomWidgets");
  const { widgetId } = Route.useParams();
  const id = widgetId as CustomWidgetId;
  const router = useRouter();
  const qc = useQueryClient();
  const { data: widget } = useSuspenseQuery(customWidgetsRepo.byId(id));

  // Seed local state once from the loader; fields own it thereafter (no refetch, so
  // the in-progress field builder never resets mid-edit).
  const [name, setName] = useState(widget.name);
  const [template, setTemplate] = useState(widget.template ?? "");
  const [element, setElement] = useState<WidgetElement | "">(widget.element ?? "");
  const [description, setDescription] = useState(widget.description ?? "");

  // Autosave a partial patch and write the returned detail straight into the cache.
  function save(patch: UpdateCustomWidgetAttributes) {
    updateCustomWidgetFn({ data: { id, patch } })
      .then((updated) => {
        qc.setQueryData(customWidgetsRepo.byId(id).queryKey, updated);
        qc.invalidateQueries({ queryKey: customWidgetsKeys.list() });
      })
      .catch((err) => {
        toast.error(content.saveError.value, {
          description: err instanceof Error ? err.message : content.tryAgain.value,
        });
      });
  }

  // The builder hands over the full field list when the user clicks Save; only persist once it
  // passes the schema (unique/valid names, min<=max, valid regex). Resolves `null` on success so
  // the builder clears its dirty markers, or the error message (shown inline by the Save button)
  // so a failed save isn't silent.
  async function saveFields(fields: CustomWidgetField[]): Promise<string | null> {
    const result = customWidgetFieldsSchema.safeParse(fields);
    if (!result.success) {
      return result.error.issues[0]?.message ?? content.fieldsInvalid.value;
    }
    try {
      const updated = await updateCustomWidgetFn({ data: { id, patch: { fields: result.data } } });
      qc.setQueryData(customWidgetsRepo.byId(id).queryKey, updated);
      qc.invalidateQueries({ queryKey: customWidgetsKeys.list() });
      return null;
    } catch (err) {
      return err instanceof Error ? err.message : content.saveRetry.value;
    }
  }

  return (
    <>
      <section className="full">
        <button type="button" onClick={() => router.history.back()}>
          {content.back}
        </button>
        <Link to="/{-$locale}/admin/custom-widgets">{content.backToList}</Link>
        <h1>{widget.name}</h1>

        <FieldGroup>
          <Field className="½">
            <FieldLabel htmlFor="cw-name">{content.nameLabel}</FieldLabel>
            <FieldBody>
              <Input
                id="cw-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={() => name.trim() && save({ name: name.trim() })}
              />
            </FieldBody>
          </Field>
          <Field className="½">
            <FieldLabel htmlFor="cw-template">{content.templateLabel}</FieldLabel>
            <FieldBody>
              <Input
                id="cw-template"
                value={template}
                onChange={(e) => setTemplate(e.target.value)}
                onBlur={() => save({ template: template.trim() || null })}
                placeholder={content.templatePlaceholder.value}
              />
            </FieldBody>
          </Field>
          <Field className="½">
            <FieldLabel htmlFor="cw-element">{content.defaultTagLabel}</FieldLabel>
            <FieldBody>
              <select
                id="cw-element"
                className={s.select}
                value={element}
                onChange={(e) => {
                  const next = (e.target.value || "") as WidgetElement | "";
                  setElement(next);
                  save({ element: next || null });
                }}
              >
                <option value="">{content.defaultTagOption.value}</option>
                {widgetElements.map((el) => (
                  <option key={el} value={el}>
                    {el}
                  </option>
                ))}
              </select>
            </FieldBody>
          </Field>
          <Field>
            <FieldLabel htmlFor="cw-description">{content.descriptionLabel}</FieldLabel>
            <FieldBody>
              <Input
                id="cw-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onBlur={() => save({ description: description.trim() || null })}
                placeholder={content.optional.value}
              />
            </FieldBody>
          </Field>
        </FieldGroup>

        <h2>{content.fieldsHeading}</h2>
        <p>{content.fieldsHelp}</p>
      </section>

      <section className="full">
        <CustomWidgetFieldsBuilder initialFields={widget.fields} onSave={saveFields} />
      </section>
    </>
  );
}
