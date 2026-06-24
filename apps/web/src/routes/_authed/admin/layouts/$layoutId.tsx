import { useRef, useState } from "react";
import { useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { type LayoutId } from "@/db/schema/layouts";
import { LOCALES, type Locale } from "@/db/schema/pages";
import LayoutBuilder, { type LayoutZoneState } from "@/components/LayoutBuilder";
import PageBuilder from "@/components/PageBuilder";
import { Field, FieldBody, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { layoutsKeys, layoutsRepo } from "@/repositories/layouts";
import { layoutWidgetsRepo, saveLayoutWidgets } from "@/repositories/layoutWidgets";
import { type UpdateLayoutAttributes, updateLayoutFn } from "@/server/fns/layouts";

export const Route = createFileRoute("/_authed/admin/layouts/$layoutId")({
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(layoutsRepo.byId(params.layoutId as LayoutId)),
  component: RouteComponent,
});

function RouteComponent() {
  const { layoutId } = Route.useParams();
  const id = layoutId as LayoutId;
  const router = useRouter();
  const qc = useQueryClient();
  const { data: layout } = useSuspenseQuery(layoutsRepo.byId(id));

  // Seed local state once from the loader; the fields and LayoutBuilder own it
  // thereafter and autosave on change (no refetch, so edits never reset mid-drag).
  const [name, setName] = useState(layout.name);
  const [description, setDescription] = useState(layout.description ?? "");
  const initialZones = useRef<LayoutZoneState[]>(
    layout.zones.map((z) => ({
      zoneId: z.zoneId,
      name: z.name,
      title: z.options.title,
      size: z.options.size,
      order: z.options.order,
      defaultOpen: z.options.defaultOpen,
    })),
  );

  // Autosave a partial patch. updateLayoutFn returns the full, updated detail, which
  // we write straight into the byId cache (no refetch — a refetch would re-suspend
  // and remount the builder, discarding the in-progress edit). The list is only
  // invalidated so its names/descriptions refresh; it isn't mounted here.
  function save(patch: UpdateLayoutAttributes) {
    updateLayoutFn({ data: { id, patch } })
      .then((updated) => {
        qc.setQueryData(layoutsRepo.byId(id).queryKey, updated);
        qc.invalidateQueries({ queryKey: layoutsKeys.list() });
      })
      .catch(console.error);
  }

  function saveZones(zones: LayoutZoneState[]) {
    save({
      zones: zones.map((z) => ({
        zoneId: z.zoneId,
        options: {
          title: z.title.trim() || z.name,
          size: z.size,
          order: z.order,
          defaultOpen: z.defaultOpen,
        },
      })),
    });
  }

  return (
    <main className="zone">
      <section className="full">
        <button type="button" onClick={() => router.history.back()}>
          ← Back
        </button>
        <Link to="/admin/layouts">Back to layouts</Link>
        <h1>{layout.name}</h1>

        <FieldGroup>
          <Field className="½">
            <FieldLabel htmlFor="layout-name">Name</FieldLabel>
            <FieldBody>
              <Input
                id="layout-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={() => name.trim() && save({ name: name.trim() })}
              />
            </FieldBody>
          </Field>
          <Field className="½">
            <FieldLabel htmlFor="layout-description">Description</FieldLabel>
            <FieldBody>
              <Input
                id="layout-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onBlur={() => save({ description: description.trim() || null })}
                placeholder="Optional"
              />
            </FieldBody>
          </Field>
        </FieldGroup>

        <h2>Zones</h2>
        <p>
          Drag a zone to reorder it; open a zone’s settings to change its size, title and default
          state. The blocks below preview the layout. Changes save automatically.
        </p>
      </section>

      <section className="full">
        <LayoutBuilder initialZones={initialZones.current} onChange={saveZones} />
      </section>

      <section className="full">
        <h2>Default widgets</h2>
        <p>
          Widgets placed here appear on every page using this layout, without being added per page.
          Pick a locale to give that language its own defaults (e.g. a localized nav menu), or “All
          locales” for defaults shared across languages (e.g. a debug panel). Each widget’s settings
          let you pin it to the top or bottom of its zone.
        </p>
        <DefaultWidgets layoutId={id} />
      </section>
    </main>
  );
}

// Per-scope editor for a layout's default widgets. A scope is a locale, or null for the
// all-locales defaults. Switching scope remounts PageBuilder (keyed by scope) so it
// re-seeds from that scope's widgets; saves autosave back to the same scope.
function DefaultWidgets({ layoutId }: { layoutId: LayoutId }) {
  const [scope, setScope] = useState<Locale | null>(null);
  const { data: layout } = useQuery(layoutWidgetsRepo.forScope(layoutId, scope));

  return (
    <>
      <label htmlFor="layout-widget-scope">Locale</label>{" "}
      <select
        id="layout-widget-scope"
        value={scope ?? ""}
        onChange={(e) => setScope(e.target.value === "" ? null : (e.target.value as Locale))}
      >
        <option value="">All locales</option>
        {LOCALES.map((l) => (
          <option key={l} value={l}>
            {l}
          </option>
        ))}
      </select>
      {layout ? (
        <PageBuilder
          key={scope ?? "all"}
          initialLayout={layout}
          ownSource="layout"
          pinnable
          zonesLocked
          alwaysEdit
          onSave={(next) => {
            saveLayoutWidgets(layoutId, scope, next).catch(console.error);
          }}
        />
      ) : (
        <p>Loading…</p>
      )}
    </>
  );
}
