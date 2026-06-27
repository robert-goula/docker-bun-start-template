import { Fragment, type ReactNode, useCallback, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ClientOnly, Link } from "@tanstack/react-router";
import { SquarePen } from "lucide-react";
import {
  closestCorners,
  type CollisionDetection,
  DndContext,
  DragOverlay,
  type DragEndEvent,
  type DragStartEvent,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { arrayMove, rectSortingStrategy, SortableContext } from "@dnd-kit/sortable";
import { cx } from "class-variance-authority";
import Zone, { ZoneGhost, type ZoneLayout } from "@/components/Zone";
import { WidgetContent, WidgetGhost, WidgetView } from "@/components/Widget";
import { useEditMode } from "@/components/EditMode";
import { layoutsRepo } from "@/repositories/layouts";
import { editOnlyWidgetKinds } from "@/components/widgetRegistry";
import { defaultContentForKind } from "@/db/schema/widgets";
import type { WidgetConfig, WidgetKind, WidgetSource } from "@/components/Widget";
import type { ZoneConfig, ZoneSize } from "@/components/Zone";
import styles from "./PageBuilder.module.css";

function findZoneByWidgetId(zones: ZoneConfig[], widgetId: string): ZoneConfig | undefined {
  return zones.find((z) => z.widgets.some((w) => w.id === widgetId));
}

// Widgets shown in the read-only view: skip edit-only kinds (e.g. debug) and any layout
// default this page suppressed.
function visibleWidgets(zone: ZoneConfig): WidgetConfig[] {
  return zone.widgets.filter((w) => !editOnlyWidgetKinds.has(w.kind) && !w.hidden);
}

// Zone content droppables use the pattern "${zoneId}:content"
function findZoneByContentDroppable(
  zones: ZoneConfig[],
  droppableId: string,
): ZoneConfig | undefined {
  return zones.find((z) => `${z.id}:content` === droppableId);
}

function reorderInZone(
  layout: ZoneLayout,
  zoneId: string,
  oldIndex: number,
  newIndex: number,
): ZoneLayout {
  return {
    zones: layout.zones.map((z) =>
      z.id === zoneId ? { ...z, widgets: arrayMove(z.widgets, oldIndex, newIndex) } : z,
    ),
  };
}

function moveBetweenZones(
  layout: ZoneLayout,
  fromZoneId: string,
  toZoneId: string,
  widgetId: string,
  overId: string,
): ZoneLayout {
  let widget: WidgetConfig | undefined;
  const zonesWithout = layout.zones.map((z) => {
    if (z.id !== fromZoneId) return z;
    widget = z.widgets.find((w) => w.id === widgetId);
    return { ...z, widgets: z.widgets.filter((w) => w.id !== widgetId) };
  });
  if (!widget) return layout;

  const movedWidget = widget;
  return {
    zones: zonesWithout.map((z) => {
      if (z.id !== toZoneId) return z;
      const overIndex = z.widgets.findIndex((w) => w.id === overId);
      const insertAt = overIndex >= 0 ? overIndex : z.widgets.length;
      const next = [...z.widgets];
      next.splice(insertAt, 0, movedWidget);
      return { ...z, widgets: next };
    }),
  };
}

function findWidgetById(zones: ZoneConfig[], widgetId: string): WidgetConfig {
  for (const zone of zones) {
    const w = zone.widgets.find((w) => w.id === widgetId);
    if (w) return w;
  }
  throw new Error("Widget not found");
}

interface PageBuilderProps {
  initialLayout: ZoneLayout;
  onSave: (layout: ZoneLayout) => void;
  // When set, zone arrangement (size, order) is owned by the page's layout and is
  // read-only here: zone drag/resize controls are hidden and only widgets are editable.
  zonesLocked?: boolean;
  // The id of the page's current layout. With `onLayoutChange`, enables the
  // edit-mode layout picker shown above the zones.
  layoutId?: string;
  // Called when the admin picks a different layout for the page; the caller persists
  // it and reloads the page so the new zone arrangement renders.
  onLayoutChange?: (layoutId: string) => void;
  // Edit-only page-level controls (e.g. the metadata editor) rendered full-width above
  // the zones, beside the layout picker. Only shown in edit mode.
  toolbar?: ReactNode;
  // Which widgets this builder owns. On a page (default "page") layout-default widgets are
  // foreign and read-only; in the layout-default editor pass "layout" so they're editable.
  ownSource?: WidgetSource;
  // Exposes a pin (top/bottom) control on each widget — used by the layout-default editor.
  pinnable?: boolean;
  // Renders the editor regardless of the global edit-mode toggle. Used by admin screens
  // (e.g. the layout-default editor) that are always in an authoring context.
  alwaysEdit?: boolean;
  // Layout-default editor: a scope label badged on each widget (e.g. "en-us" or
  // "All locales") so it's clear which locale's defaults are being edited.
  localeBadge?: string;
  // Caller content rendered between the hero and main zones (in both view and edit
  // mode). Used to embed page-specific content (e.g. admin screens) inside the
  // page-builder chrome. Falls back to the top of <main> if the layout has no hero.
  betweenHeroAndMain?: ReactNode;
}

function PageLayoutOptions({
  layoutId,
  onLayoutChange,
}: {
  layoutId: string;
  onLayoutChange: (layoutId: string) => void;
}) {
  const { data: layouts = [] } = useQuery(layoutsRepo.list());
  return (
    <section className={styles.options}>
      <label className={styles.optionsLabel} htmlFor="page-layout">
        Layout
      </label>
      <select
        id="page-layout"
        className={styles.optionsSelect}
        value={layoutId}
        onChange={(e) => onLayoutChange(e.target.value)}
      >
        {layouts.map((l) => (
          <option key={l.id} value={l.id}>
            {l.name}
          </option>
        ))}
      </select>
      <Link
        to="/{-$locale}/admin/layouts/$layoutId"
        params={{ layoutId }}
        className={styles.optionsEdit}
        aria-label="Edit layout"
        title="Edit layout"
      >
        <SquarePen size={16} aria-hidden="true" />
      </Link>
    </section>
  );
}

/**
 * Drag-and-drop page builder for a page's zones and widgets. Manages the layout
 * locally and reports every change through `onSave` so the caller can persist it.
 */
export default function PageBuilder({
  initialLayout,
  onSave,
  zonesLocked = false,
  layoutId,
  onLayoutChange,
  toolbar,
  ownSource = "page",
  pinnable = false,
  alwaysEdit = false,
  localeBadge,
  betweenHeroAndMain,
}: PageBuilderProps) {
  const { editMode } = useEditMode();
  const inEditMode = editMode || alwaysEdit;
  const [layout, setLayout] = useState<ZoneLayout>(initialLayout);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [activeDragType, setActiveDragType] = useState<"zone" | "widget" | null>(null);

  const sensors = useSensors(useSensor(PointerSensor));

  function commit(next: ZoneLayout) {
    setLayout(next);
    onSave(next);
  }

  /**
   * Zones collide only with zones; widgets collide only with widgets and zone-content droppables.
   * pointerWithin is the primary strategy so cursor position is the source of truth, with
   * closestCorners as fallback for first/last-position edge cases where the pointer may be
   * outside all droppable rects.
   */
  const collisionDetection: CollisionDetection = useCallback((args) => {
    const activeType = args.active.data.current?.type as string | undefined;
    const filtered = args.droppableContainers.filter(({ data }) => {
      const t = data.current?.type as string | undefined;
      return activeType === "zone" ? t === "zone" : t === "widget" || t === "zone-content";
    });
    const filteredArgs = { ...args, droppableContainers: filtered };
    const hits = pointerWithin(filteredArgs);
    return hits.length > 0 ? hits : closestCorners(filteredArgs);
  }, []);

  function handleDragStart({ active }: DragStartEvent) {
    setActiveDragId(active.id as string);
    setActiveDragType((active.data.current?.type as "zone" | "widget") ?? null);
  }

  function handleDragCancel() {
    setActiveDragId(null);
    setActiveDragType(null);
  }

  function handleZoneSizeChange(zoneId: string, size: ZoneSize) {
    commit({ zones: layout.zones.map((z) => (z.id === zoneId ? { ...z, size } : z)) });
  }

  function handleWidgetDelete(zoneId: string, widgetId: string) {
    commit({
      zones: layout.zones.map((z) =>
        z.id === zoneId ? { ...z, widgets: z.widgets.filter((w) => w.id !== widgetId) } : z,
      ),
    });
  }

  function handleWidgetOptionsChange(
    zoneId: string,
    widgetId: string,
    options: WidgetConfig["options"],
  ) {
    commit({
      zones: layout.zones.map((z) =>
        z.id === zoneId
          ? { ...z, widgets: z.widgets.map((w) => (w.id === widgetId ? { ...w, options } : w)) }
          : z,
      ),
    });
  }

  function handleWidgetContentChange(
    zoneId: string,
    widgetId: string,
    content: WidgetConfig["content"],
  ) {
    commit({
      zones: layout.zones.map((z) =>
        z.id === zoneId
          ? { ...z, widgets: z.widgets.map((w) => (w.id === widgetId ? { ...w, content } : w)) }
          : z,
      ),
    });
  }

  // Toggles whether a foreign (layout-default) widget is suppressed on this page.
  // The suppressed flag lives on the widget config; savePage derives the id list from it.
  function handleWidgetHiddenChange(zoneId: string, widgetId: string) {
    commit({
      zones: layout.zones.map((z) =>
        z.id === zoneId
          ? {
              ...z,
              widgets: z.widgets.map((w) => (w.id === widgetId ? { ...w, hidden: !w.hidden } : w)),
            }
          : z,
      ),
    });
  }

  function handleWidgetAdd(zoneId: string, kind: WidgetKind, definitionId?: string) {
    const widget: WidgetConfig = {
      id: crypto.randomUUID(),
      kind,
      // Dynamic widgets bind to a custom widget definition by id (stored in options).
      options: definitionId ? { definitionId } : {},
      content: defaultContentForKind(kind),
    };
    commit({
      zones: layout.zones.map((z) =>
        z.id === zoneId ? { ...z, widgets: [...z.widgets, widget] } : z,
      ),
    });
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    setActiveDragId(null);
    setActiveDragType(null);
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;
    const activeType = active.data.current?.type as string | undefined;

    if (activeType === "zone") {
      if (zonesLocked) return; // zone arrangement is owned by the layout
      const oldIndex = layout.zones.findIndex((z) => z.id === activeId);
      const newIndex = layout.zones.findIndex((z) => z.id === overId);
      if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
        commit({
          zones: arrayMove(layout.zones, oldIndex, newIndex).map((z, i) => ({ ...z, order: i })),
        });
      }
      return;
    }

    const activeZone = findZoneByWidgetId(layout.zones, activeId);
    if (!activeZone) return;

    const overZone =
      findZoneByWidgetId(layout.zones, overId) ?? findZoneByContentDroppable(layout.zones, overId);
    if (!overZone) return;

    if (activeZone.id === overZone.id) {
      const oldIndex = activeZone.widgets.findIndex((w) => w.id === activeId);
      const newIndex = overZone.widgets.findIndex((w) => w.id === overId);
      if (oldIndex !== newIndex && newIndex >= 0) {
        commit(reorderInZone(layout, activeZone.id, oldIndex, newIndex));
      }
    } else {
      commit(moveBetweenZones(layout, activeZone.id, overZone.id, activeId, overId));
    }
  }

  const zoneIds = layout.zones.map((z) => z.id);
  // Caller content renders right after the hero zone; if the layout dropped the hero
  // it falls back to the top of <main> so the slot is never silently lost.
  const hasHero = layout.zones.some((z) => z.name === "hero");

  if (!inEditMode) {
    // The nav zone is hoisted out of <main> into its own top-level <nav> landmark
    // (rendered before <main>, so the DOM order is header → nav → main → footer).
    // Its widgets render content-only (no WidgetView <section> wrapper) so the markup
    // stays tight — a menu becomes <nav><ul>…</ul></nav>. Menus render bare (element
    // "none"): the zone already is the nav landmark, so they shed their own wrapper.
    const navZone = layout.zones.find((z) => z.name === "nav");
    const navWidgets = navZone ? visibleWidgets(navZone) : [];
    return (
      <>
        {navWidgets.length > 0 && navZone ? (
          <nav id="top">
            {navWidgets.map((widget) => (
              <WidgetContent
                key={widget.id}
                kind={widget.kind}
                options={
                  widget.kind === "menu" ? { ...widget.options, element: "none" } : widget.options
                }
                content={widget.content}
              />
            ))}
          </nav>
        ) : null}
        <main>
          {!hasHero ? betweenHeroAndMain : null}
          {layout.zones.map((zone) => {
            if (zone.name === "nav") return null;
            const visible = visibleWidgets(zone);
            const zoneEl =
              visible.length === 0 ? null : (
                <div key={zone.id} className={cx(styles.viewZone, zone.size)}>
                  {visible.map((widget) => (
                    <WidgetView key={widget.id} widget={widget} />
                  ))}
                </div>
              );
            // The caller's content sits directly after the hero zone (rendered even
            // when the hero has no widgets of its own).
            if (zone.name === "hero") {
              return (
                <Fragment key={`${zone.id}:hero-slot`}>
                  {zoneEl}
                  {betweenHeroAndMain}
                </Fragment>
              );
            }
            return zoneEl;
          })}
        </main>
      </>
    );
  }

  return (
    <ClientOnly fallback={null}>
      <main>
        {layoutId && onLayoutChange ? (
          <PageLayoutOptions layoutId={layoutId} onLayoutChange={onLayoutChange} />
        ) : null}
        {toolbar ? <div style={{ gridColumn: "1 / -1" }}>{toolbar}</div> : null}
        {!hasHero ? betweenHeroAndMain : null}
        <DndContext
          sensors={sensors}
          collisionDetection={collisionDetection}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          <SortableContext items={zoneIds} strategy={rectSortingStrategy}>
            {layout.zones.map((zone) => {
              const zoneEl = (
                <Zone
                  key={zone.id}
                  id={zone.id}
                  name={zone.name}
                  title={zone.title}
                  size={zone.size}
                  defaultOpen={zone.defaultOpen}
                  locked={zonesLocked}
                  widgets={zone.widgets}
                  ownSource={ownSource}
                  pinnable={pinnable}
                  localeBadge={localeBadge}
                  onSizeChange={(size) => handleZoneSizeChange(zone.id, size)}
                  onWidgetDelete={(widgetId) => handleWidgetDelete(zone.id, widgetId)}
                  onWidgetOptionsChange={(widgetId, options) =>
                    handleWidgetOptionsChange(zone.id, widgetId, options)
                  }
                  onWidgetContentChange={(widgetId, content) =>
                    handleWidgetContentChange(zone.id, widgetId, content)
                  }
                  onWidgetAdd={(kind, definitionId) => handleWidgetAdd(zone.id, kind, definitionId)}
                  onWidgetHiddenChange={(widgetId) => handleWidgetHiddenChange(zone.id, widgetId)}
                />
              );
              // Mirror the view-mode placement: caller content sits after the hero zone.
              if (zone.name === "hero") {
                return (
                  <Fragment key={`${zone.id}:hero-slot`}>
                    {zoneEl}
                    {betweenHeroAndMain}
                  </Fragment>
                );
              }
              return zoneEl;
            })}
          </SortableContext>
          <DragOverlay>
            {activeDragType === "widget" && activeDragId ? (
              <WidgetGhost kind={findWidgetById(layout.zones, activeDragId).kind as WidgetKind} />
            ) : activeDragType === "zone" && activeDragId ? (
              <ZoneGhost title={layout.zones.find((z) => z.id === activeDragId)?.title ?? ""} />
            ) : null}
          </DragOverlay>
        </DndContext>
      </main>
    </ClientOnly>
  );
}
