// oxlint-disable oxc/only-used-in-recursion -- false positive: Zone forwards these
// props to its <Zone.Content> compound component, which oxc misreads as recursion.
import type React from "react";
import { createContext, useContext, useId, useState } from "react";
import {
  AddIcon,
  ArrowDropDownIcon,
  DragIndicatorIcon,
  MoreVertIcon,
  SettingsIcon,
} from "@/components/icons";
import s from "./Zone.module.css";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cx } from "class-variance-authority";
import Widget from "@/components/Widget";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { WidgetConfig, WidgetKind } from "@/components/Widget";
import { widgetKindList } from "@/components/widgetRegistry";

export type ZoneSize = "full" | "½" | "⅓" | "⅔" | "¼" | "¾";
export type ZoneLayout = {
  zones: ZoneConfig[];
};
/** A page's renderable layout: its ordered zones and their widget content. */
export type PageLayout = ZoneLayout;
export const zoneSizeOptions: { label: string; value: ZoneSize }[] = [
  { label: "Full", value: "full" },
  { label: "3/4", value: "¾" },
  { label: "2/3", value: "⅔" },
  { label: "1/2", value: "½" },
  { label: "1/3", value: "⅓" },
  { label: "1/4", value: "¼" },
];

interface ZoneContextProps {
  zoneId: string;
  droppableId: string;
  contentId: string;
  toggleId: string;
  open: boolean;
  setOpen: (open: boolean) => void;
  toggleOpen: () => void;
}
const ZoneContext = createContext<ZoneContextProps | null>(null);

export interface ZoneConfig {
  id: string;
  name: string;
  title: string;
  size: ZoneSize;
  order: number;
  defaultOpen: boolean;
  widgets: WidgetConfig[];
}

interface ZoneProps {
  id: string;
  title: string;
  name?: string;
  size?: ZoneSize;
  defaultOpen?: boolean;
  // When set, the zone's arrangement (size, reorder) is owned by the layout and
  // not editable here: the drag handle and size settings are hidden.
  locked?: boolean;
  // When set, the zone has no widget content (e.g. the layout editor): the content
  // area, add-widget button and collapse toggle are omitted, leaving a sized block.
  contentless?: boolean;
  widgets: WidgetConfig[];
  onSizeChange?: (size: ZoneSize) => void;
  // When provided (layout editor), the settings dialog edits the full zone
  // arrangement and applies it in a single change so nothing clobbers anything.
  onArrangementChange?: (next: { size: ZoneSize; title: string; defaultOpen: boolean }) => void;
  onWidgetDelete?: (widgetId: string) => void;
  onWidgetOptionsChange?: (widgetId: string, options: WidgetConfig["options"]) => void;
  onWidgetContentChange?: (widgetId: string, content: WidgetConfig["content"]) => void;
  onWidgetAdd?: (kind: WidgetKind) => void;
}

interface ZoneControlProps {
  children?: React.ReactNode;
}
interface ZoneHeaderProps {
  children?: React.ReactNode;
}
interface ZoneContentProps {
  widgets: WidgetConfig[];
  onWidgetDelete?: (widgetId: string) => void;
  onWidgetOptionsChange?: (widgetId: string, options: WidgetConfig["options"]) => void;
  onWidgetContentChange?: (widgetId: string, content: WidgetConfig["content"]) => void;
  onWidgetAdd?: (kind: WidgetKind) => void;
}

function Zone({
  id,
  name,
  size = "full",
  defaultOpen = false,
  locked = false,
  contentless = false,
  title,
  widgets,
  onSizeChange,
  onArrangementChange,
  onWidgetDelete,
  onWidgetOptionsChange,
  onWidgetContentChange,
  onWidgetAdd,
}: ZoneProps) {
  const internalId = useId();
  const [open, setOpen] = useState(defaultOpen);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [pendingSize, setPendingSize] = useState<ZoneSize>(size);
  const [pendingTitle, setPendingTitle] = useState(title);
  const [pendingDefaultOpen, setPendingDefaultOpen] = useState(defaultOpen);

  // Zone-level sortable — drag handle in header, type discriminates from widget drags
  const {
    attributes: zoneAttributes,
    listeners: zoneDragListeners,
    setNodeRef: setZoneRef,
    transform: zoneTransform,
    transition: zoneTransition,
    isDragging: isZoneDragging,
  } = useSortable({ id, data: { type: "zone" } });

  const classNames = cx(s.zone, size);
  const zoneSortableStyle: React.CSSProperties = isZoneDragging
    ? { opacity: 0 }
    : { transform: CSS.Transform.toString(zoneTransform), transition: zoneTransition ?? undefined };

  function toggleOpen() {
    setOpen(!open);
  }

  function handleSettingsOpenChange(next: boolean) {
    if (next) {
      setPendingSize(size);
      setPendingTitle(title);
      setPendingDefaultOpen(defaultOpen);
    }
    setSettingsOpen(next);
  }

  function handleApply() {
    if (onArrangementChange) {
      onArrangementChange({
        size: pendingSize,
        title: pendingTitle.trim() || title,
        defaultOpen: pendingDefaultOpen,
      });
    } else {
      onSizeChange?.(pendingSize);
    }
    setSettingsOpen(false);
  }

  return (
    <ZoneContext.Provider
      value={{
        zoneId: id,
        droppableId: `${id}:content`,
        contentId: `${internalId}-content`,
        toggleId: `${internalId}-toggle`,
        open,
        setOpen,
        toggleOpen,
      }}
    >
      <section
        ref={setZoneRef}
        className={classNames}
        data-name={name}
        data-open={open}
        id={internalId}
        style={contentless ? { ...zoneSortableStyle, minBlockSize: "5rem" } : zoneSortableStyle}
        {...zoneAttributes}
      >
        <Zone.Header>
          {!locked && (
            <span {...zoneDragListeners} className={s.zoneDragHandle}>
              <DragIndicatorIcon title="Drag zone to reorder" className={s.dragHandle} />
            </span>
          )}
          <button className={s.zone__title} onClick={toggleOpen} type="button">
            {title}
            {onArrangementChange && name && name !== title && (
              <span className={s.zone__originalName}> ({name})</span>
            )}
          </button>
          <Zone.Controls>
            {!contentless && <Zone.Toggle />}
            {!locked && (
              <Dialog open={settingsOpen} onOpenChange={handleSettingsOpenChange}>
                <DialogTrigger
                  render={
                    <button type="button" aria-label="Zone settings">
                      <SettingsIcon />
                    </button>
                  }
                />
                <DialogContent showCloseButton={false}>
                  <DialogHeader>
                    <DialogTitle>Zone Settings</DialogTitle>
                  </DialogHeader>
                  {onArrangementChange && (
                    <label className={s.sizeLabel}>
                      Title
                      <input
                        type="text"
                        value={pendingTitle}
                        onChange={(e) => setPendingTitle(e.target.value)}
                      />
                    </label>
                  )}
                  <fieldset className={s.sizeOptions}>
                    <legend className={s.sizeLabel}>Size</legend>
                    {zoneSizeOptions.map(({ label, value }) => (
                      <label key={value} className={s.sizeOption}>
                        <input
                          type="radio"
                          name={`zone-size-${internalId}`}
                          value={value}
                          checked={pendingSize === value}
                          onChange={() => setPendingSize(value)}
                        />
                        {label}
                      </label>
                    ))}
                  </fieldset>
                  {onArrangementChange && (
                    <label className={s.sizeOption}>
                      <input
                        type="checkbox"
                        checked={pendingDefaultOpen}
                        onChange={(e) => setPendingDefaultOpen(e.target.checked)}
                      />
                      Open by default
                    </label>
                  )}
                  <DialogFooter>
                    <DialogClose render={<button type="button" className={s.btnCancel} />}>
                      Cancel
                    </DialogClose>
                    <button type="button" className={s.btnApply} onClick={handleApply}>
                      Apply
                    </button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
            {/* biome-ignore lint/a11y/useButtonType: <explanation> */}
            <button>
              <MoreVertIcon />
            </button>
          </Zone.Controls>
        </Zone.Header>
        {!contentless && (
          <Zone.Content
            widgets={widgets}
            onWidgetDelete={onWidgetDelete}
            onWidgetOptionsChange={onWidgetOptionsChange}
            onWidgetContentChange={onWidgetContentChange}
            onWidgetAdd={onWidgetAdd}
          />
        )}
      </section>
    </ZoneContext.Provider>
  );
}

Zone.Header = function ZoneHeader({ children }: ZoneHeaderProps) {
  return <header>{children}</header>;
};

Zone.Toggle = function ZoneToggle() {
  const ctx = useContext(ZoneContext);
  if (!ctx) throw new Error("Zone.Toggle must be used within a Zone");
  // const toggleId = useUniqueId('zone-toggle');
  const { toggleId, contentId, open, toggleOpen } = ctx;
  return (
    <button
      aria-controls={contentId}
      aria-expanded={open}
      aria-labelledby={toggleId}
      className={s.zone__toggle}
      id={toggleId}
      onClick={toggleOpen}
      type="button"
    >
      <span className={cx(s.zoneIndicator, !open && s.collapsed)}>
        <ArrowDropDownIcon aria-hidden="true" />
      </span>
      <span id={toggleId}>Toggle Zone Content</span>
    </button>
  );
};

Zone.Controls = function ZoneControls({ children }: ZoneControlProps) {
  const ctx = useContext(ZoneContext);
  if (!ctx) throw new Error("Zone.Controls must be used within a Zone");
  const { zoneId } = ctx;
  return <menu aria-label={`Controls for ${zoneId}`}>{children}</menu>;
};

Zone.Content = function ZoneContent({
  widgets,
  onWidgetDelete,
  onWidgetOptionsChange,
  onWidgetContentChange,
  onWidgetAdd,
}: ZoneContentProps) {
  const ctx = useContext(ZoneContext);
  if (!ctx) throw new Error("Zone.Content must be used within a Zone");
  const { zoneId, droppableId, contentId, open, toggleId } = ctx;
  const { isOver, setNodeRef } = useDroppable({
    id: droppableId,
    data: { type: "zone-content", zoneId },
  });
  const isEmpty = widgets.length === 0;
  const [pickerOpen, setPickerOpen] = useState(false);

  function handleAdd(kind: WidgetKind) {
    setPickerOpen(false);
    onWidgetAdd?.(kind);
  }

  return (
    <section
      aria-labelledby={toggleId}
      className={s.zone__content}
      hidden={!open}
      id={contentId}
      ref={setNodeRef}
      data-over={isOver || undefined}
      data-empty={isEmpty || undefined}
    >
      <SortableContext items={widgets.map((w) => w.id)} strategy={verticalListSortingStrategy}>
        {widgets.map((w) => (
          <Widget
            key={w.id}
            id={w.id}
            kind={w.kind}
            options={w.options}
            content={w.content}
            onDelete={() => onWidgetDelete?.(w.id)}
            onOptionsChange={(options) => onWidgetOptionsChange?.(w.id, options)}
            onContentChange={(content) => onWidgetContentChange?.(w.id, content)}
          />
        ))}
      </SortableContext>
      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogTrigger
          render={
            <button type="button" className={s.addWidget} aria-label="Add widget to this zone">
              <AddIcon aria-hidden="true" />
              Add widget
            </button>
          }
        />
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Add widget</DialogTitle>
          </DialogHeader>
          <div className={s.kindList}>
            {widgetKindList.map((kind) => (
              <button
                key={kind}
                type="button"
                className={s.kindOption}
                onClick={() => handleAdd(kind)}
              >
                {kind}
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
};

export function ZoneGhost({ title }: { title: string }) {
  return (
    <section data-slot="zone-ghost" className={cx(s.zone, s.ghost)}>
      <header>
        <DragIndicatorIcon className={s.dragHandle} />
        <span className={s.zone__title}>{title}</span>
      </header>
    </section>
  );
}

export default Zone;
