import { useState } from "react";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useIntlayer } from "react-intlayer";
import { toast } from "sonner";
import AdminCmsPage from "@/components/AdminCmsPage";
import MenuItemsBuilder from "@/components/MenuItemsBuilder";
import { Field, FieldBody, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  type MenuId,
  type MenuItem,
  type MenuOrientation,
  type MenuSubmenuMode,
  menuItemsSchema,
} from "@/db/schema/menus";
import { buildAdminHead, loadAdminPage } from "@/lib/loadPage";
import { idParam } from "@/lib/shortId";
import { menusKeys, menusRepo } from "@/repositories/menus";
import { pagesRepo } from "@/repositories/pages";
import { type UpdateMenuAttributes, updateMenuFn } from "@/server/fns/menus";
import s from "./$menuId.module.css";

const PAGE_SLUG = "/admin/menus";

export const Route = createFileRoute("/{-$locale}/_authed/admin/menus/$menuId")({
  params: idParam("menuId"),
  loader: async ({ context, params }) => {
    const ref = { slug: PAGE_SLUG, locale: context.i18n.locale };
    const [{ layout: pageLayout, meta, siteName }] = await Promise.all([
      loadAdminPage(context.queryClient, ref),
      context.queryClient.ensureQueryData(menusRepo.byId(params.menuId as MenuId)),
      context.queryClient.ensureQueryData(pagesRepo.groups()),
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
      <MenuDetail />
    </AdminCmsPage>
  );
}

function MenuDetail() {
  const content = useIntlayer("adminMenus");
  const { menuId } = Route.useParams();
  const id = menuId as MenuId;
  const qc = useQueryClient();
  const { data: menu } = useSuspenseQuery(menusRepo.byId(id));
  const { data: pageGroups } = useSuspenseQuery(pagesRepo.groups());

  // Seed local state once from the loader; the builder owns the items thereafter (no
  // refetch, so the in-progress tree never resets mid-edit).
  const [name, setName] = useState(menu.name);
  const [slug, setSlug] = useState(menu.slug);
  const [description, setDescription] = useState(menu.description ?? "");
  const [orientation, setOrientation] = useState<MenuOrientation>(menu.orientation);
  const [submenuMode, setSubmenuMode] = useState<MenuSubmenuMode>(menu.submenuMode);

  // Autosave a partial patch and write the returned detail straight into the cache.
  function save(patch: UpdateMenuAttributes) {
    updateMenuFn({ data: { id, patch } })
      .then((updated) => {
        qc.setQueryData(menusRepo.byId(id).queryKey, updated);
        qc.invalidateQueries({ queryKey: menusKeys.list() });
      })
      .catch((err) => {
        toast.error(content.saveError.value, {
          description: err instanceof Error ? err.message : content.tryAgain.value,
        });
      });
  }

  // Validate the tree before persisting (depth cap, per-type required fields) and surface
  // why not. Resolves true on success so the builder can re-baseline its dirty markers.
  async function saveItems(items: MenuItem[]): Promise<boolean> {
    const result = menuItemsSchema.safeParse(items);
    if (!result.success) {
      toast.error(content.saveMenuError.value, {
        description: result.error.issues[0]?.message ?? content.itemsInvalid.value,
      });
      return false;
    }
    try {
      const updated = await updateMenuFn({ data: { id, patch: { items: result.data } } });
      qc.setQueryData(menusRepo.byId(id).queryKey, updated);
      qc.invalidateQueries({ queryKey: menusKeys.list() });
      return true;
    } catch (err) {
      toast.error(content.saveMenuError.value, {
        description: err instanceof Error ? err.message : content.tryAgain.value,
      });
      return false;
    }
  }

  return (
    <>
      <section className="full">
        <p>
          <Link to="/{-$locale}/admin/menus">{content.backToMenus}</Link>
        </p>
        <h1>{content.editMenu}</h1>

        <FieldGroup>
          <Field className="⅓">
            <FieldLabel htmlFor="menu-name">{content.nameLabel}</FieldLabel>
            <FieldBody>
              <Input
                id="menu-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={() => name.trim() && name !== menu.name && save({ name: name.trim() })}
              />
            </FieldBody>
          </Field>
          <Field className="⅓">
            <FieldLabel htmlFor="menu-slug">{content.slugLabel}</FieldLabel>
            <FieldBody>
              <Input
                id="menu-slug"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                onBlur={() => slug.trim() && slug !== menu.slug && save({ slug: slug.trim() })}
              />
            </FieldBody>
          </Field>
          <Field className="⅓">
            <FieldLabel htmlFor="menu-description">{content.descriptionLabel}</FieldLabel>
            <FieldBody>
              <Input
                id="menu-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onBlur={() =>
                  description !== (menu.description ?? "") &&
                  save({ description: description.trim() || null })
                }
              />
            </FieldBody>
          </Field>
          <Field className="⅓">
            <FieldLabel htmlFor="menu-orientation">{content.orientationLabel}</FieldLabel>
            <FieldBody>
              <select
                id="menu-orientation"
                className={s.select}
                value={orientation}
                onChange={(e) => {
                  const next = e.target.value as MenuOrientation;
                  setOrientation(next);
                  save({ orientation: next });
                }}
              >
                <option value="vertical">{content.vertical.value}</option>
                <option value="horizontal">{content.horizontal.value}</option>
              </select>
            </FieldBody>
          </Field>
          <Field className="⅓">
            <FieldLabel htmlFor="menu-submenu-mode">{content.submenuLabel}</FieldLabel>
            <FieldBody>
              <select
                id="menu-submenu-mode"
                className={s.select}
                value={submenuMode}
                onChange={(e) => {
                  const next = e.target.value as MenuSubmenuMode;
                  setSubmenuMode(next);
                  save({ submenuMode: next });
                }}
              >
                <option value="expanded">{content.alwaysExpanded.value}</option>
                <option value="dropdown">{content.dropdown.value}</option>
              </select>
            </FieldBody>
          </Field>
        </FieldGroup>

        <h2 className={s.itemsHeading}>{content.itemsHeading}</h2>
        <MenuItemsBuilder initialItems={menu.items} pageGroups={pageGroups} onSave={saveItems} />
      </section>
    </>
  );
}
