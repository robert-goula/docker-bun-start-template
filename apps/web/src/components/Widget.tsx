import { useDndContext } from "@dnd-kit/core";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Suspense, createContext, useContext, useId, useState } from "react";
import { cx } from "class-variance-authority";
import s from "@/components/Widget.module.css";
import { DeleteIcon, DragIndicatorIcon, EditIcon, SettingsIcon } from "@/components/icons";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { type ZoneSize, zoneSizeOptions } from "@/components/Zone";
import type { Json } from "@/types/Json";
import registry, { editableWidgetKinds } from "@/components/widgetRegistry";

export type WidgetKind = "markdown" | "debug" | "dynamic";

export interface WidgetContentProps {
  options: WidgetOptions;
  onOptionsChange?: (options: WidgetOptions) => void;
  editing?: boolean;
  onEditingChange?: (editing: boolean) => void;
}

export interface WidgetContextProps {
  contentId: string;
  toggleId: string;
  open: boolean;
  setOpen: (open: boolean) => void;
  toggleOpen: () => void;
}

export type WidgetOptions = { [key: string]: Json };

export const widgetClassNames = (options: WidgetOptions) =>
  cx((options.size as string | undefined) ?? "full", options.className as string | undefined);

export interface WidgetConfig {
  id: string;
  kind: WidgetKind;
  options: WidgetOptions;
  content: Json;
}

const WidgetContext = createContext<WidgetContextProps | null>(null);

interface WidgetControlProps {
  children?: React.ReactNode;
}
interface WidgetHeaderProps {
  children?: React.ReactNode;
}

interface WidgetProps extends WidgetConfig {
  onDelete?: () => void;
  onOptionsChange?: (options: WidgetConfig["options"]) => void;
  onContentChange?: (content: WidgetConfig["content"]) => void;
}

export interface WidgetContentProps {
  kind: WidgetKind;
  options: WidgetConfig["options"];
  content?: WidgetConfig["content"];
  editing?: boolean;
  onOptionsChange?: (options: WidgetConfig["options"]) => void;
  onContentChange?: (content: WidgetConfig["content"]) => void;
  onEditingChange?: (editing: boolean) => void;
}

export function WidgetContent({
  kind,
  options,
  content,
  editing,
  onOptionsChange,
  onContentChange,
  onEditingChange,
}: WidgetContentProps) {
  const ContentComponent = registry[kind];
  return (
    <Suspense fallback={<div>Loading…</div>}>
      <ContentComponent
        kind={kind}
        options={options}
        content={content}
        onOptionsChange={onOptionsChange}
        onContentChange={onContentChange}
        editing={editing}
        onEditingChange={onEditingChange}
      />
    </Suspense>
  );
}

const Widget = function Widget({
  id,
  kind,
  options,
  content,
  onDelete,
  onOptionsChange,
  onContentChange,
}: WidgetProps) {
  const widgetId = useId();
  const size = (options.size as ZoneSize | undefined) ?? "full";
  const className = (options.className as string | undefined) ?? "";
  const [open, setOpen] = useState(true);
  const toggleOpen = () => setOpen((prev) => !prev);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [pendingSize, setPendingSize] = useState<ZoneSize>(size);
  const [pendingClassName, setPendingClassName] = useState(className);

  const editable = editableWidgetKinds.has(kind);

  function toggleEdit() {
    const next = !editing;
    setEditing(next);
    if (next) setOpen(true); // editing requires the content to be visible
  }

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    data: { type: "widget" },
  });

  const { over, active } = useDndContext();
  const isDropTarget = over?.id === id && active?.id !== id;

  const style: React.CSSProperties = isDragging
    ? { opacity: 0 }
    : { transform: CSS.Transform.toString(transform), transition };

  function handleSettingsOpenChange(next: boolean) {
    if (next) {
      setPendingSize(size);
      setPendingClassName(className);
    }
    setSettingsOpen(next);
  }

  function handleApply() {
    // `className` has no default — drop the key entirely when it's blank.
    const trimmed = pendingClassName.trim();
    const { className: _omit, ...rest } = options;
    onOptionsChange?.({ ...rest, size: pendingSize, ...(trimmed ? { className: trimmed } : {}) });
    setSettingsOpen(false);
  }

  function handleConfirmDelete() {
    setConfirmOpen(false);
    onDelete?.();
  }

  return (
    <WidgetContext.Provider
      value={{
        contentId: `${widgetId}-content`,
        toggleId: `${widgetId}-toggle`,
        open,
        setOpen,
        toggleOpen,
      }}
    >
      <section
        ref={setNodeRef}
        data-slot="widget"
        data-kind={kind}
        data-drop-target={isDropTarget || undefined}
        style={style}
        className={cx(s.widget, widgetClassNames(options))}
        {...attributes}
      >
        <Widget.Header>
          <span {...listeners} className={s.dragHandle}>
            <DragIndicatorIcon title="Drag to reorder" />
          </span>
          <button className={s.title} onClick={toggleOpen} type="button">
            {kind}
          </button>
          <Widget.Controls>
            <button
              type="button"
              className={s.collapseToggle}
              onClick={toggleOpen}
              aria-label={open ? "Collapse widget" : "Expand widget"}
            >
              <span className={cx(s.collapseIcon, !open && s.collapsed)}>▾</span>
            </button>
            {editable && (
              <button
                type="button"
                aria-label={editing ? "Stop editing" : "Edit content"}
                aria-pressed={editing}
                onClick={toggleEdit}
              >
                <EditIcon />
              </button>
            )}
            <Dialog open={settingsOpen} onOpenChange={handleSettingsOpenChange}>
              <DialogTrigger
                render={
                  <button type="button" aria-label="Widget settings">
                    <SettingsIcon />
                  </button>
                }
              />
              <DialogContent showCloseButton={false}>
                <DialogHeader>
                  <DialogTitle>Widget Settings</DialogTitle>
                </DialogHeader>
                <div className={s.field}>
                  <label className={s.fieldLabel} htmlFor={`widget-class-${widgetId}`}>
                    Class names
                  </label>
                  <Input
                    id={`widget-class-${widgetId}`}
                    value={pendingClassName}
                    onChange={(e) => setPendingClassName(e.target.value)}
                    placeholder="e.g. featured highlight"
                  />
                </div>
                <fieldset className={s.sizeOptions}>
                  <legend className={s.sizeLabel}>Size</legend>
                  {zoneSizeOptions.map(({ label, value }) => (
                    <label key={value} className={s.sizeOption}>
                      <input
                        type="radio"
                        name={`widget-size-${widgetId}`}
                        value={value}
                        checked={pendingSize === value}
                        onChange={() => setPendingSize(value)}
                      />
                      {label}
                    </label>
                  ))}
                </fieldset>
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
            <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
              <DialogTrigger
                render={
                  <button type="button" aria-label="Delete widget">
                    <DeleteIcon />
                  </button>
                }
              />
              <DialogContent showCloseButton={false}>
                <DialogHeader>
                  <DialogTitle>Delete widget</DialogTitle>
                </DialogHeader>
                <p>
                  Delete the <strong>{kind}</strong> widget from this page? This can’t be undone.
                </p>
                <DialogFooter>
                  <DialogClose render={<button type="button" className={s.btnCancel} />}>
                    Cancel
                  </DialogClose>
                  <button type="button" className={s.btnApply} onClick={handleConfirmDelete}>
                    Delete
                  </button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </Widget.Controls>
        </Widget.Header>
        {open && (
          <WidgetContent
            kind={kind}
            options={options}
            content={content}
            editing={editing}
            onOptionsChange={onOptionsChange}
            onContentChange={onContentChange}
            onEditingChange={setEditing}
          />
        )}
      </section>
    </WidgetContext.Provider>
  );
};

Widget.Header = function WidgetHeader({ children }: WidgetHeaderProps) {
  return <header className={s.header}>{children}</header>;
};

Widget.Controls = function WidgetControls({ children }: WidgetControlProps) {
  const ctx = useContext(WidgetContext);
  if (!ctx) {
    throw new Error("Widget.Controls must be used within a Widget");
  }
  return <menu className={s.controls}>{children}</menu>;
};

export type WidgetGhostKind = {
  kind: WidgetKind;
};
export function WidgetGhost({ kind }: WidgetGhostKind) {
  return (
    <section data-slot="widget-ghost" className={cx(s.widget, s.ghost, "full")}>
      <header className={s.header}>
        <DragIndicatorIcon className={s.dragHandle} />
        <span className={s.title}>{kind}</span>
        <div className={s.controls} />
      </header>
    </section>
  );
}

export default Widget;
