import { useCallback, useState } from "react";
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
import { WidgetContent, WidgetGhost } from "@/components/Widget";
import { useEditMode } from "@/components/EditMode";
import { layoutsRepo } from "@/repositories/layouts";
import { editOnlyWidgetKinds } from "@/components/widgetRegistry";
import type { WidgetConfig, WidgetKind } from "@/components/Widget";
import type { ZoneConfig, ZoneSize } from "@/components/Zone";
import styles from "./PageBuilder.module.css";

function findZoneByWidgetId(zones: ZoneConfig[], widgetId: string): ZoneConfig | undefined {
  return zones.find((z) => z.widgets.some((w) => w.id === widgetId));
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
        to="/admin/layouts/$layoutId"
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
}: PageBuilderProps) {
  const { editMode } = useEditMode();
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

  function handleWidgetSizeChange(zoneId: string, widgetId: string, size: ZoneSize) {
    commit({
      zones: layout.zones.map((z) =>
        z.id === zoneId
          ? { ...z, widgets: z.widgets.map((w) => (w.id === widgetId ? { ...w, size } : w)) }
          : z,
      ),
    });
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

  function handleWidgetAdd(zoneId: string, kind: WidgetKind) {
    const widget: WidgetConfig = { id: crypto.randomUUID(), kind, options: {} };
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

  if (!editMode) {
    return (
      <main>
        {layout.zones.map((zone) => {
          const visible = zone.widgets.filter((w) => !editOnlyWidgetKinds.has(w.kind));
          if (visible.length === 0) return null;
          return (
            <div key={zone.id} className={cx(styles.viewZone, zone.size)}>
              {visible.map((widget) => (
                <article key={widget.id} className={widget.size ?? "full"}>
                  <WidgetContent kind={widget.kind} options={widget.options} />
                </article>
              ))}
            </div>
          );
        })}
      </main>
    );
  }

  return (
    <ClientOnly fallback={null}>
      <main>
        {layoutId && onLayoutChange ? (
          <PageLayoutOptions layoutId={layoutId} onLayoutChange={onLayoutChange} />
        ) : null}
        <DndContext
          sensors={sensors}
          collisionDetection={collisionDetection}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          <SortableContext items={zoneIds} strategy={rectSortingStrategy}>
            {layout.zones.map((zone) => (
              <Zone
                key={zone.id}
                id={zone.id}
                name={zone.name}
                title={zone.title}
                size={zone.size}
                defaultOpen={zone.defaultOpen}
                locked={zonesLocked}
                widgets={zone.widgets}
                onSizeChange={(size) => handleZoneSizeChange(zone.id, size)}
                onWidgetSizeChange={(widgetId, size) =>
                  handleWidgetSizeChange(zone.id, widgetId, size)
                }
                onWidgetDelete={(widgetId) => handleWidgetDelete(zone.id, widgetId)}
                onWidgetOptionsChange={(widgetId, options) =>
                  handleWidgetOptionsChange(zone.id, widgetId, options)
                }
                onWidgetAdd={(kind) => handleWidgetAdd(zone.id, kind)}
              />
            ))}
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
