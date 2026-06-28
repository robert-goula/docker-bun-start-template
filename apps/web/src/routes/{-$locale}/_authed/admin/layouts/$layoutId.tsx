import { useRef, useState } from "react";
import { useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useIntlayer } from "react-intlayer";
import { type LayoutId } from "@/db/schema/layouts";
import { LOCALES, type Locale } from "@/db/schema/pages";
import AdminCmsPage from "@/components/AdminCmsPage";
import LayoutBuilder, { type LayoutZoneState } from "@/components/LayoutBuilder";
import PageBuilder from "@/components/PageBuilder";
import { Field, FieldBody, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { buildAdminHead, loadAdminPage } from "@/lib/loadPage";
import { idParam } from "@/lib/shortId";
import { layoutsKeys, layoutsRepo } from "@/repositories/layouts";
import { layoutWidgetsRepo, saveLayoutWidgets } from "@/repositories/layoutWidgets";
import { type UpdateLayoutAttributes, updateLayoutFn } from "@/server/fns/layouts";
import styles from "./$layoutId.module.css";

const PAGE_SLUG = "/admin/layouts";

export const Route = createFileRoute("/{-$locale}/_authed/admin/layouts/$layoutId")({
  params: idParam("layoutId"),
  loader: async ({ context, params }) => {
    const ref = { slug: PAGE_SLUG, locale: context.i18n.locale };
    const [{ layout: pageLayout, meta, siteName }] = await Promise.all([
      loadAdminPage(context.queryClient, ref),
      context.queryClient.ensureQueryData(layoutsRepo.byId(params.layoutId as LayoutId)),
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
      <LayoutDetail />
    </AdminCmsPage>
  );
}

function LayoutDetail() {
  const content = useIntlayer("adminLayouts");
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
    <>
      <section className="full">
        <button type="button" onClick={() => router.history.back()}>
          {content.back}
        </button>
        <Link to="/{-$locale}/admin/layouts">{content.backToLayouts}</Link>
        <h1>{layout.name}</h1>

        <FieldGroup>
          <Field className="½">
            <FieldLabel htmlFor="layout-name">{content.nameLabel}</FieldLabel>
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
            <FieldLabel htmlFor="layout-description">{content.descriptionLabel}</FieldLabel>
            <FieldBody>
              <Input
                id="layout-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onBlur={() => save({ description: description.trim() || null })}
                placeholder={content.optional.value}
              />
            </FieldBody>
          </Field>
        </FieldGroup>

        <h2>{content.zonesHeading}</h2>
        <p>{content.zonesHelp}</p>
      </section>

      <section className="full">
        <LayoutBuilder initialZones={initialZones.current} onChange={saveZones} />
      </section>

      <section className="full">
        <h2>{content.defaultWidgetsHeading}</h2>
        <p>{content.defaultWidgetsHelp}</p>
        <DefaultWidgets layoutId={id} />
      </section>
    </>
  );
}

// Per-scope editor for a layout's default widgets. A scope is a locale, or null for the
// all-locales defaults. Switching scope remounts PageBuilder (keyed by scope) so it
// re-seeds from that scope's widgets; saves autosave back to the same scope.
function DefaultWidgets({ layoutId }: { layoutId: LayoutId }) {
  const content = useIntlayer("adminLayouts");
  const [scope, setScope] = useState<Locale | null>(null);
  const { data: layout } = useQuery(layoutWidgetsRepo.forScope(layoutId, scope));

  const scopeLabel = scope ?? content.allLocales.value;

  return (
    <>
      <div className={styles.scopeBar}>
        <label htmlFor="layout-widget-scope" className={styles.scopeLabel}>
          {content.editingDefaultsFor}
        </label>
        <select
          id="layout-widget-scope"
          className={styles.scopeSelect}
          value={scope ?? ""}
          onChange={(e) => setScope(e.target.value === "" ? null : (e.target.value as Locale))}
        >
          <option value="">{content.allLocales.value}</option>
          {LOCALES.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
        <span className={styles.scopeHint}>
          {scope ? (
            <>
              {content.shownOnlyOn} {scope} {content.localePages}
            </>
          ) : (
            content.scopeHintAll
          )}
        </span>
      </div>
      {layout ? (
        <PageBuilder
          key={scope ?? "all"}
          initialLayout={layout}
          ownSource="layout"
          pinnable
          zonesLocked
          alwaysEdit
          localeBadge={scopeLabel}
          onSave={(next) => {
            saveLayoutWidgets(layoutId, scope, next).catch(console.error);
          }}
        />
      ) : (
        <p>{content.loading}</p>
      )}
    </>
  );
}
