import { type CSSProperties, useCallback, useState } from "react";
import { ClientOnly } from "@tanstack/react-router";
import {
  closestCenter,
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
import Zone, { ZoneGhost } from "@/components/Zone";
import type { ZoneSize } from "@/components/Zone";

export interface LayoutZoneState {
  zoneId: string;
  name: string;
  title: string;
  size: ZoneSize;
  order: number;
  defaultOpen: boolean;
}

interface LayoutBuilderProps {
  initialZones: LayoutZoneState[];
  onChange: (zones: LayoutZoneState[]) => void;
}

const gridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(12, 1fr)",
  gap: "var(--spacing-lg)",
};

/**
 * Visual editor for a layout's zone arrangement. Zones render as sized blocks in a
 * 12-column grid (a live preview of the layout): drag to reorder, and use each
 * zone's settings to change size, title and default-open. Reports every change
 * through `onChange` so the caller can persist it.
 */
export default function LayoutBuilder({ initialZones, onChange }: LayoutBuilderProps) {
  const [zones, setZones] = useState<LayoutZoneState[]>(initialZones);
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor));

  // Exclude the dragged zone from the candidates so a collision can never resolve
  // back to itself (which otherwise cancels the reorder — most visibly for the
  // full-width first zone). Cursor position picks the target, with a center-based
  // fallback when the pointer is in a gap.
  const collisionDetection: CollisionDetection = useCallback((args) => {
    const candidates = args.droppableContainers.filter((c) => c.id !== args.active.id);
    const scoped = { ...args, droppableContainers: candidates };
    const hits = pointerWithin(scoped);
    return hits.length > 0 ? hits : closestCenter(scoped);
  }, []);

  function commit(next: LayoutZoneState[]) {
    setZones(next);
    onChange(next);
  }

  function updateZone(zoneId: string, patch: Partial<LayoutZoneState>) {
    commit(zones.map((z) => (z.zoneId === zoneId ? { ...z, ...patch } : z)));
  }

  function handleDragStart({ active }: DragStartEvent) {
    setActiveId(active.id as string);
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null);
    if (!over || active.id === over.id) return;
    const oldIndex = zones.findIndex((z) => z.zoneId === active.id);
    const newIndex = zones.findIndex((z) => z.zoneId === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    commit(arrayMove(zones, oldIndex, newIndex).map((z, i) => ({ ...z, order: i })));
  }

  const ids = zones.map((z) => z.zoneId);

  return (
    <ClientOnly fallback={null}>
      <DndContext
        sensors={sensors}
        collisionDetection={collisionDetection}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setActiveId(null)}
      >
        <SortableContext items={ids} strategy={rectSortingStrategy}>
          <div style={gridStyle}>
            {zones.map((zone) => (
              <Zone
                key={zone.zoneId}
                id={zone.zoneId}
                name={zone.name}
                title={zone.title}
                size={zone.size}
                defaultOpen={zone.defaultOpen}
                contentless
                widgets={[]}
                onArrangementChange={(next) => updateZone(zone.zoneId, next)}
              />
            ))}
          </div>
        </SortableContext>
        <DragOverlay>
          {activeId ? (
            <ZoneGhost title={zones.find((z) => z.zoneId === activeId)?.title ?? ""} />
          ) : null}
        </DragOverlay>
      </DndContext>
    </ClientOnly>
  );
}
