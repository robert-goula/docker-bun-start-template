import { useState } from "react";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { toast } from "sonner";
import CustomWidgetFieldsBuilder from "@/components/CustomWidgetFieldsBuilder";
import { Field, FieldBody, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  type CustomWidgetField,
  type CustomWidgetId,
  customWidgetFieldsSchema,
} from "@/db/schema/customWidgets";
import { type WidgetElement, widgetElements } from "@/db/schema/widgets";
import { idParam } from "@/lib/shortId";
import { customWidgetsKeys, customWidgetsRepo } from "@/repositories/customWidgets";
import {
  type UpdateCustomWidgetAttributes,
  updateCustomWidgetFn,
} from "@/server/fns/customWidgets";
import s from "./$widgetId.module.css";

export const Route = createFileRoute("/_authed/admin/custom-widgets/$widgetId")({
  params: idParam("widgetId"),
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(customWidgetsRepo.byId(params.widgetId as CustomWidgetId)),
  component: RouteComponent,
});

function RouteComponent() {
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
        toast.error("Couldn’t save changes", {
          description: err instanceof Error ? err.message : "Please try again.",
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
      return result.error.issues[0]?.message ?? "Some fields are invalid.";
    }
    try {
      const updated = await updateCustomWidgetFn({ data: { id, patch: { fields: result.data } } });
      qc.setQueryData(customWidgetsRepo.byId(id).queryKey, updated);
      qc.invalidateQueries({ queryKey: customWidgetsKeys.list() });
      return null;
    } catch (err) {
      return err instanceof Error ? err.message : "Couldn’t save changes. Please try again.";
    }
  }

  return (
    <>
      <section className="full">
        <button type="button" onClick={() => router.history.back()}>
          ← Back
        </button>
        <Link to="/admin/custom-widgets">Back to custom widgets</Link>
        <h1>{widget.name}</h1>

        <FieldGroup>
          <Field className="½">
            <FieldLabel htmlFor="cw-name">Name</FieldLabel>
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
            <FieldLabel htmlFor="cw-template">Template</FieldLabel>
            <FieldBody>
              <Input
                id="cw-template"
                value={template}
                onChange={(e) => setTemplate(e.target.value)}
                onBlur={() => save({ template: template.trim() || null })}
                placeholder="Optional display component key (e.g. headline)"
              />
            </FieldBody>
          </Field>
          <Field className="½">
            <FieldLabel htmlFor="cw-element">Default tag</FieldLabel>
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
                <option value="">Default (section)</option>
                {widgetElements.map((el) => (
                  <option key={el} value={el}>
                    {el}
                  </option>
                ))}
              </select>
            </FieldBody>
          </Field>
          <Field>
            <FieldLabel htmlFor="cw-description">Description</FieldLabel>
            <FieldBody>
              <Input
                id="cw-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onBlur={() => save({ description: description.trim() || null })}
                placeholder="Optional"
              />
            </FieldBody>
          </Field>
        </FieldGroup>

        <h2>Fields</h2>
        <p>
          Drag a field to reorder it; the order here is how the fields are shown when editing and
          displaying an instance. Edits stay local until you click Save changes.
        </p>
      </section>

      <section className="full">
        <CustomWidgetFieldsBuilder initialFields={widget.fields} onSave={saveFields} />
      </section>
    </>
  );
}
