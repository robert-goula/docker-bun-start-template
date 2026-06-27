import { useState } from "react";
import { ClientOnly } from "@tanstack/react-router";
import { AddIcon, DeleteIcon } from "@/components/icons";
import { AddButton } from "@/components/ui/addButton";
import { Button } from "@/components/ui/button";
import { Field, FieldBody, FieldLabel } from "@/components/ui/field";
import { IconButton } from "@/components/ui/iconButton";
import { Input } from "@/components/ui/input";
import { MENU_MAX_DEPTH, type MenuItem } from "@/db/schema/menus";
import type { SafePageGroup } from "@/server/fns/pages";
import s from "./MenuItemsBuilder.module.css";

type Items = MenuItem[];
type ItemType = MenuItem["type"];

const newId = () => crypto.randomUUID();

// Builds a fresh item of `type`, preserving `id`, `children`, and a `label` when both the
// old and new types carry one (so toggling type keeps the typed label/subtree).
function makeItem(
  type: ItemType,
  pageGroups: ReadonlyArray<SafePageGroup>,
  prev?: MenuItem,
): MenuItem {
  const id = prev?.id ?? newId();
  const children = prev?.children ?? [];
  const label = prev && "label" in prev ? prev.label : undefined;
  switch (type) {
    case "page":
      return { id, type: "page", groupId: pageGroups[0]?.groupId ?? "", label, children };
    case "external":
      return { id, type: "external", href: "", label: label ?? "", children };
    case "heading":
      return { id, type: "heading", label: label ?? "", children };
  }
}

// --- Immutable tree operations, keyed by item id ------------------------------------

function updateItem(items: Items, id: string, fn: (item: MenuItem) => MenuItem): Items {
  return items.map((it) => {
    if (it.id === id) return fn(it);
    return it.children.length ? { ...it, children: updateItem(it.children, id, fn) } : it;
  });
}

function removeItem(items: Items, id: string): Items {
  return items
    .filter((it) => it.id !== id)
    .map((it) => (it.children.length ? { ...it, children: removeItem(it.children, id) } : it));
}

function addChild(items: Items, parentId: string | null, child: MenuItem): Items {
  if (parentId === null) return [...items, child];
  return items.map((it) => {
    if (it.id === parentId) return { ...it, children: [...it.children, child] };
    return it.children.length ? { ...it, children: addChild(it.children, parentId, child) } : it;
  });
}

// Swaps an item with its previous/next sibling (dir -1 / +1).
function moveSibling(items: Items, id: string, dir: -1 | 1): Items {
  const idx = items.findIndex((it) => it.id === id);
  if (idx !== -1) {
    const target = idx + dir;
    if (target < 0 || target >= items.length) return items;
    const next = items.slice();
    [next[idx], next[target]] = [next[target], next[idx]];
    return next;
  }
  return items.map((it) =>
    it.children.length ? { ...it, children: moveSibling(it.children, id, dir) } : it,
  );
}

// Nests an item under its immediately-preceding sibling. No-op for the first item in a list.
function indent(items: Items, id: string): Items {
  const idx = items.findIndex((it) => it.id === id);
  if (idx > 0) {
    const item = items[idx];
    const prev = items[idx - 1];
    const next = items.slice();
    next.splice(idx, 1);
    next[idx - 1] = { ...prev, children: [...prev.children, item] };
    return next;
  }
  if (idx === 0) return items;
  return items.map((it) =>
    it.children.length ? { ...it, children: indent(it.children, id) } : it,
  );
}

// Lifts an item out to become a sibling of its parent (placed right after it). No-op at root.
function outdent(items: Items, id: string): Items {
  const result: Items = [];
  for (const it of items) {
    const j = it.children.findIndex((c) => c.id === id);
    if (j !== -1) {
      const child = it.children[j];
      const newChildren = it.children.slice();
      newChildren.splice(j, 1);
      result.push({ ...it, children: newChildren });
      result.push(child);
    } else {
      result.push(it.children.length ? { ...it, children: outdent(it.children, id) } : it);
    }
  }
  return result;
}

interface MenuItemsBuilderProps {
  initialItems: ReadonlyArray<MenuItem>;
  pageGroups: ReadonlyArray<SafePageGroup>;
  // Persist the current tree. Resolves true on success (the builder re-baselines and clears
  // its dirty marker) or false on a validation/save failure (the draft is kept).
  onSave: (items: MenuItem[]) => Promise<boolean>;
}

/**
 * Editor for a menu's hierarchical item tree. Items are added/typed inline; ordering and
 * nesting use move-up/down + indent/outdent controls (drag-nesting can follow later). The
 * whole tree is reported through `onSave`; the caller validates (depth cap, required fields)
 * and persists.
 */
export default function MenuItemsBuilder({
  initialItems,
  pageGroups,
  onSave,
}: MenuItemsBuilderProps) {
  const [items, setItems] = useState<Items>(() => initialItems as Items);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  function mutate(fn: (items: Items) => Items) {
    setItems((prev) => fn(prev));
    setDirty(true);
  }

  function handleSave() {
    setSaving(true);
    onSave(items)
      .then((ok) => {
        if (ok) setDirty(false);
      })
      .finally(() => setSaving(false));
  }

  function discard() {
    setItems(initialItems as Items);
    setDirty(false);
  }

  return (
    <ClientOnly fallback={null}>
      <ItemList
        items={items}
        depth={1}
        pageGroups={pageGroups}
        onMutate={mutate}
        onAdd={(parentId, type) =>
          mutate((prev) => addChild(prev, parentId, makeItem(type, pageGroups)))
        }
      />
      {items.length === 0 && <p className={s.empty}>No items yet. Add one to get started.</p>}

      <div className={s.toolbar}>
        <div className={s.addRoot}>
          <AddButton
            onClick={() => mutate((prev) => addChild(prev, null, makeItem("page", pageGroups)))}
          >
            Add page link
          </AddButton>
          <AddButton
            onClick={() => mutate((prev) => addChild(prev, null, makeItem("external", pageGroups)))}
          >
            Add external link
          </AddButton>
          <AddButton
            onClick={() => mutate((prev) => addChild(prev, null, makeItem("heading", pageGroups)))}
          >
            Add heading
          </AddButton>
        </div>
        {dirty && (
          <div className={s.saveActions}>
            <span className={s.dirtyHint}>Unsaved changes</span>
            <Button type="button" variant="outline" size="sm" onClick={discard} disabled={saving}>
              Discard
            </Button>
            <Button type="button" intent="primary" size="sm" onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : "Save menu"}
            </Button>
          </div>
        )}
      </div>
    </ClientOnly>
  );
}

function ItemList({
  items,
  depth,
  pageGroups,
  onMutate,
  onAdd,
}: {
  items: Items;
  depth: number;
  pageGroups: ReadonlyArray<SafePageGroup>;
  onMutate: (fn: (items: Items) => Items) => void;
  onAdd: (parentId: string | null, type: ItemType) => void;
}) {
  return (
    <ol className={s.list}>
      {items.map((item, index) => (
        <ItemRow
          key={item.id}
          item={item}
          index={index}
          siblingCount={items.length}
          depth={depth}
          pageGroups={pageGroups}
          onMutate={onMutate}
          onAdd={onAdd}
        />
      ))}
    </ol>
  );
}

function ItemRow({
  item,
  index,
  siblingCount,
  depth,
  pageGroups,
  onMutate,
  onAdd,
}: {
  item: MenuItem;
  index: number;
  siblingCount: number;
  depth: number;
  pageGroups: ReadonlyArray<SafePageGroup>;
  onMutate: (fn: (items: Items) => Items) => void;
  onAdd: (parentId: string | null, type: ItemType) => void;
}) {
  const idBase = item.id;
  const canChildNest = depth < MENU_MAX_DEPTH;

  function setType(type: ItemType) {
    onMutate((prev) => updateItem(prev, item.id, (it) => makeItem(type, pageGroups, it)));
  }
  function patch(fn: (item: MenuItem) => MenuItem) {
    onMutate((prev) => updateItem(prev, item.id, fn));
  }

  return (
    <li className={s.row}>
      <div className={s.rowHeader}>
        <select
          aria-label="Item type"
          className={s.select}
          value={item.type}
          onChange={(e) => setType(e.target.value as ItemType)}
        >
          <option value="page">Page</option>
          <option value="external">External</option>
          <option value="heading">Heading</option>
        </select>

        <div className={s.rowFields}>
          {item.type === "page" && (
            <>
              <Field>
                <FieldLabel htmlFor={`${idBase}-page`}>Page</FieldLabel>
                <FieldBody>
                  <select
                    id={`${idBase}-page`}
                    className={s.select}
                    value={item.groupId}
                    onChange={(e) =>
                      patch((it) => (it.type === "page" ? { ...it, groupId: e.target.value } : it))
                    }
                  >
                    {pageGroups.length === 0 && <option value="">No pages</option>}
                    {pageGroups.map((g) => (
                      <option key={g.groupId} value={g.groupId}>
                        {g.title} ({g.slug})
                      </option>
                    ))}
                  </select>
                </FieldBody>
              </Field>
              <Field>
                <FieldLabel htmlFor={`${idBase}-label`}>Label override</FieldLabel>
                <FieldBody>
                  <Input
                    id={`${idBase}-label`}
                    value={item.label ?? ""}
                    placeholder="Defaults to the page title"
                    onChange={(e) =>
                      patch((it) =>
                        it.type === "page" ? { ...it, label: e.target.value || undefined } : it,
                      )
                    }
                  />
                </FieldBody>
              </Field>
            </>
          )}

          {item.type === "external" && (
            <>
              <Field>
                <FieldLabel htmlFor={`${idBase}-href`}>URL</FieldLabel>
                <FieldBody>
                  <Input
                    id={`${idBase}-href`}
                    value={item.href}
                    placeholder="https://example.com"
                    onChange={(e) =>
                      patch((it) => (it.type === "external" ? { ...it, href: e.target.value } : it))
                    }
                  />
                </FieldBody>
              </Field>
              <Field>
                <FieldLabel htmlFor={`${idBase}-ext-label`}>Label</FieldLabel>
                <FieldBody>
                  <Input
                    id={`${idBase}-ext-label`}
                    value={item.label}
                    onChange={(e) =>
                      patch((it) =>
                        it.type === "external" ? { ...it, label: e.target.value } : it,
                      )
                    }
                  />
                </FieldBody>
              </Field>
              <Field>
                <FieldLabel htmlFor={`${idBase}-newtab`}>New tab</FieldLabel>
                <FieldBody>
                  <label className={s.checkbox}>
                    <input
                      id={`${idBase}-newtab`}
                      type="checkbox"
                      checked={item.newTab ?? false}
                      onChange={(e) =>
                        patch((it) =>
                          it.type === "external"
                            ? { ...it, newTab: e.target.checked || undefined }
                            : it,
                        )
                      }
                    />
                    Open in a new tab
                  </label>
                </FieldBody>
              </Field>
            </>
          )}

          {item.type === "heading" && (
            <Field>
              <FieldLabel htmlFor={`${idBase}-heading`}>Label</FieldLabel>
              <FieldBody>
                <Input
                  id={`${idBase}-heading`}
                  value={item.label}
                  onChange={(e) =>
                    patch((it) => (it.type === "heading" ? { ...it, label: e.target.value } : it))
                  }
                />
              </FieldBody>
            </Field>
          )}
        </div>

        <menu className={s.controls}>
          <IconButton
            aria-label="Move up"
            disabled={index === 0}
            onClick={() => onMutate((prev) => moveSibling(prev, item.id, -1))}
          >
            ↑
          </IconButton>
          <IconButton
            aria-label="Move down"
            disabled={index === siblingCount - 1}
            onClick={() => onMutate((prev) => moveSibling(prev, item.id, 1))}
          >
            ↓
          </IconButton>
          <IconButton
            aria-label="Indent (nest under previous item)"
            disabled={index === 0 || depth >= MENU_MAX_DEPTH}
            onClick={() => onMutate((prev) => indent(prev, item.id))}
          >
            →
          </IconButton>
          <IconButton
            aria-label="Outdent"
            disabled={depth === 1}
            onClick={() => onMutate((prev) => outdent(prev, item.id))}
          >
            ←
          </IconButton>
          {canChildNest && (
            <IconButton aria-label="Add child item" onClick={() => onAdd(item.id, "page")}>
              <AddIcon />
            </IconButton>
          )}
          <IconButton
            tone="danger"
            aria-label="Delete item"
            onClick={() => onMutate((prev) => removeItem(prev, item.id))}
          >
            <DeleteIcon />
          </IconButton>
        </menu>
      </div>

      {item.children.length > 0 && (
        <div className={s.children}>
          <ItemList
            items={item.children}
            depth={depth + 1}
            pageGroups={pageGroups}
            onMutate={onMutate}
            onAdd={onAdd}
          />
        </div>
      )}
    </li>
  );
}
