import { useQuery } from "@tanstack/react-query";
import { useLocation } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { DEFAULT_LOCALE } from "@/db/schema/pages";
import type { MenuId, MenuLink } from "@/db/schema/menus";
import { resolveLocale } from "@/lib/locale";
import { menusRepo } from "@/repositories/menus";
import type { WidgetContentProps } from "@/components/Widget";
import s from "./Menu.module.css";

/**
 * The "menu" widget kind: renders a reusable menu (built in the admin menu builder) bound
 * by `options.menuId`. The menu is resolved for the page's locale — page items become that
 * locale's URL + title — so one menu auto-translates. Edit mode is just the bind picker;
 * the menu's structure is edited in the builder, not inline.
 */
export default function Menu({
  options,
  editing = false,
  onOptionsChange,
  onEditingChange,
}: WidgetContentProps) {
  const menuId = options.menuId as string | undefined;

  if (editing) {
    return (
      <MenuPicker
        menuId={menuId}
        options={options}
        onOptionsChange={onOptionsChange}
        onEditingChange={onEditingChange}
      />
    );
  }

  if (!menuId) {
    // In edit mode (onOptionsChange present) prompt to bind; in view mode render nothing.
    return onOptionsChange ? (
      <p className={s.notice}>This menu widget isn’t linked to a menu yet — use the edit icon.</p>
    ) : null;
  }

  return <MenuView menuId={menuId as MenuId} />;
}

// View path: reads the locale-baked render projection (SSR-prefetched in the page loader)
// for the current locale and renders the nested nav. A missing/empty menu renders nothing.
function MenuView({ menuId }: { menuId: MenuId }) {
  const { pathname } = useLocation();
  const locale = resolveLocale(pathname).locale ?? DEFAULT_LOCALE;
  const { data: menu } = useQuery(menusRepo.forRender(menuId, locale));

  if (!menu || menu.items.length === 0) return null;
  return (
    <nav className={s.nav} aria-label={menu.name}>
      <MenuTree items={menu.items} />
    </nav>
  );
}

function MenuTree({ items }: { items: ReadonlyArray<MenuLink> }) {
  return (
    <ul className={s.list}>
      {items.map((item) => (
        <li key={item.id} className={s.item}>
          {item.href ? (
            <a
              href={item.href}
              className={s.link}
              {...(item.newTab ? { target: "_blank", rel: "noopener noreferrer" } : {})}
            >
              {item.label}
            </a>
          ) : (
            <span className={s.heading}>{item.label}</span>
          )}
          {item.children.length > 0 && <MenuTree items={item.children} />}
        </li>
      ))}
    </ul>
  );
}

// Edit path: pick which menu this widget renders. Writes `options.menuId`, mirroring how an
// unbound dynamic widget prompts for its definition.
function MenuPicker({
  menuId,
  options,
  onOptionsChange,
  onEditingChange,
}: {
  menuId: string | undefined;
  options: WidgetContentProps["options"];
  onOptionsChange?: WidgetContentProps["onOptionsChange"];
  onEditingChange?: (editing: boolean) => void;
}) {
  const { data: menus = [] } = useQuery(menusRepo.list());

  return (
    <div className={s.picker}>
      <label className={s.pickerLabel}>
        Menu
        <select
          className={s.select}
          value={menuId ?? ""}
          onChange={(e) => {
            // Drop the key entirely when cleared — options values must be JSON (no undefined).
            const { menuId: _omit, ...rest } = options;
            onOptionsChange?.(e.target.value ? { ...rest, menuId: e.target.value } : rest);
          }}
        >
          <option value="">— Select a menu —</option>
          {menus.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </label>
      <Button size="sm" intent="primary" onClick={() => onEditingChange?.(false)}>
        Done
      </Button>
    </div>
  );
}
