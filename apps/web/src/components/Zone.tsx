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
import Widget, { LayoutWidgetCard } from "@/components/Widget";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useQuery } from "@tanstack/react-query";
import type { WidgetConfig, WidgetKind, WidgetSource } from "@/components/Widget";
import { widgetKindList } from "@/components/widgetRegistry";
import { customWidgetsRepo } from "@/repositories/customWidgets";

export type ZoneSize = "full" | "½" | "⅓" | "⅔" | "¼" | "¾" | "⅕" | "⅖" | "⅗" | "⅘";
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
  { label: "1/5", value: "⅕"},
  { label: "2/5", value: "⅖" },
  { label: "3/5", value: "⅗" },
  { label: "4/5", value: "⅘" },
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
  // Which widgets this builder owns (editable). Widgets whose `source` differs are
  // foreign (e.g. layout defaults shown read-only on a page). Defaults to "page".
  ownSource?: WidgetSource;
  // Layout-default editor: own widgets expose a pin (top/bottom) control.
  pinnable?: boolean;
  // Layout-default editor: a scope label badged on each own widget (e.g. "en-us").
  localeBadge?: string;
  onSizeChange?: (size: ZoneSize) => void;
  // When provided (layout editor), the settings dialog edits the full zone
  // arrangement and applies it in a single change so nothing clobbers anything.
  onArrangementChange?: (next: { size: ZoneSize; title: string; defaultOpen: boolean }) => void;
  onWidgetDelete?: (widgetId: string) => void;
  onWidgetOptionsChange?: (widgetId: string, options: WidgetConfig["options"]) => void;
  onWidgetContentChange?: (widgetId: string, content: WidgetConfig["content"]) => void;
  onWidgetAdd?: (kind: WidgetKind, definitionId?: string) => void;
  // Toggles whether a foreign (layout) widget is suppressed on this page.
  onWidgetHiddenChange?: (widgetId: string) => void;
}

interface ZoneControlProps {
  children?: React.ReactNode;
}
interface ZoneHeaderProps {
  children?: React.ReactNode;
}
interface ZoneContentProps {
  widgets: WidgetConfig[];
  ownSource?: WidgetSource;
  pinnable?: boolean;
  localeBadge?: string;
  onWidgetDelete?: (widgetId: string) => void;
  onWidgetOptionsChange?: (widgetId: string, options: WidgetConfig["options"]) => void;
  onWidgetContentChange?: (widgetId: string, content: WidgetConfig["content"]) => void;
  onWidgetAdd?: (kind: WidgetKind, definitionId?: string) => void;
  onWidgetHiddenChange?: (widgetId: string) => void;
}

// A widget is foreign to this builder when it carries a different `source` (e.g. a
// layout default shown read-only on a page). Foreign widgets render via LayoutWidgetCard,
// pinned around the builder's own sortable widgets.
const isForeign = (widget: WidgetConfig, ownSource: WidgetSource) =>
  widget.source !== undefined && widget.source !== ownSource;

const pinOf = (widget: WidgetConfig) => (widget.options.pin === "bottom" ? "bottom" : "top");

function Zone({
  id,
  name,
  size = "full",
  defaultOpen = false,
  locked = false,
  contentless = false,
  title,
  widgets,
  ownSource = "page",
  pinnable = false,
  localeBadge,
  onSizeChange,
  onArrangementChange,
  onWidgetDelete,
  onWidgetOptionsChange,
  onWidgetContentChange,
  onWidgetAdd,
  onWidgetHiddenChange,
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
            ownSource={ownSource}
            pinnable={pinnable}
            localeBadge={localeBadge}
            onWidgetDelete={onWidgetDelete}
            onWidgetOptionsChange={onWidgetOptionsChange}
            onWidgetContentChange={onWidgetContentChange}
            onWidgetAdd={onWidgetAdd}
            onWidgetHiddenChange={onWidgetHiddenChange}
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
      <span id={toggleId} className="sr-only">
        Toggle Zone Content
      </span>
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
  ownSource = "page",
  pinnable = false,
  localeBadge,
  onWidgetDelete,
  onWidgetOptionsChange,
  onWidgetContentChange,
  onWidgetAdd,
  onWidgetHiddenChange,
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
  // Reusable custom widget definitions; each is offered as a "dynamic" instance.
  const { data: definitions = [] } = useQuery(customWidgetsRepo.list());

  function handleAdd(kind: WidgetKind, definitionId?: string) {
    setPickerOpen(false);
    onWidgetAdd?.(kind, definitionId);
  }

  // Foreign widgets (layout defaults on a page) are read-only and pinned around this
  // builder's own, sortable widgets. Only own widgets take part in drag/drop and saving.
  const foreign = widgets.filter((w) => isForeign(w, ownSource));
  const own = widgets.filter((w) => !isForeign(w, ownSource));
  const pinnedTop = foreign.filter((w) => pinOf(w) !== "bottom");
  const pinnedBottom = foreign.filter((w) => pinOf(w) === "bottom");

  const renderForeign = (w: WidgetConfig) => (
    <LayoutWidgetCard
      key={w.id}
      widget={w}
      onToggleHidden={onWidgetHiddenChange ? () => onWidgetHiddenChange(w.id) : undefined}
    />
  );

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
      {pinnedTop.map(renderForeign)}
      <SortableContext items={own.map((w) => w.id)} strategy={verticalListSortingStrategy}>
        {own.map((w) => (
          <Widget
            key={w.id}
            id={w.id}
            kind={w.kind}
            options={w.options}
            content={w.content}
            pinnable={pinnable}
            localeBadge={localeBadge}
            onDelete={() => onWidgetDelete?.(w.id)}
            onOptionsChange={(options) => onWidgetOptionsChange?.(w.id, options)}
            onContentChange={(content) => onWidgetContentChange?.(w.id, content)}
          />
        ))}
      </SortableContext>
      {pinnedBottom.map(renderForeign)}
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
            {definitions.map((def) => (
              <button
                key={def.id}
                type="button"
                className={s.kindOption}
                onClick={() => handleAdd("dynamic", def.id)}
              >
                {def.name}
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
