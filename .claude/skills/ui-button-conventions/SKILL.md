---
name: ui-button-conventions
description: Conventions for add / delete / icon-only / primary buttons across the admin and page-builder UI, via the shared AddButton and IconButton components plus label wording. Use when adding or restyling any "Add …", delete/remove, icon-only, or create/save button so the UI stays consistent.
---

# UI Button Conventions

Three button families. **Use the shared components — don't hand-roll** per-file `.iconButton` /
`.addWidget` / `.addItem` styles (they were consolidated into the components below).

## 1. Add to a collection → `AddButton`

`@/components/ui/addButton`. A dashed, muted button with a **leading plus icon** and a two-word
**"Add <noun>"** label. Use it to append to a list / zone / repeatable group — **not** for form
submits.

- Inline by default (sits in a toolbar/row). Pass **`block`** for a full-width, own-row button.
- The plus icon and dashed border are mandatory — never render a bare "+".
- Label is always verb + noun ("Add widget", "Add field", "Add item", "Add page link"), never just
  "Add".

```tsx
<AddButton onClick={addField}>Add field</AddButton>          // inline
<AddButton block onClick={addItem}>Add item</AddButton>      // full-width row
<DialogTrigger render={<AddButton block className={s.addWidget}>Add widget</AddButton>} />
```

Reference uses: `Zone.tsx` (Add widget), `CustomWidgetFieldsBuilder.tsx` (Add field),
`widgets/Dynamic.tsx` (Add item, repeatable), `MenuItemsBuilder.tsx` (Add page link / …).

## 2. Icon-only action → `IconButton`

`@/components/ui/iconButton`. Plain (no border/fill), **muted by default**. `aria-label` is
**required** (no visible text). Renders a real `<button>`, so it also works as a `render` target
(Dialog/Tooltip trigger).

- **Hover colour:** non-destructive actions tint to **primary** (edit, settings, visibility eye,
  reorder ↑↓←→, collapse, add-child); destructive actions use **`tone="danger"`** → red.
- Holds an icon or a text glyph (▾ ↑ →). Swap the icon by state (e.g. visibility on/off), but keep
  the muted-default / primary-hover colour — don't colour by state.

```tsx
<IconButton aria-label="Edit color"><EditIcon /></IconButton>
<IconButton tone="danger" aria-label="Remove item"><DeleteIcon /></IconButton>
<DialogTrigger render={<IconButton tone="danger" aria-label="Delete widget"><DeleteIcon /></IconButton>} />
```

Reference uses: `Widget.tsx` (collapse / edit / settings / delete / visibility), `Zone.tsx`
(settings), `MenuItemsBuilder.tsx` (reorder / add-child / delete), `CustomWidgetFieldsBuilder.tsx`
(collapse / remove field), `admin/taxonomy/index.tsx` (Edit / Delete row actions),
`widgets/Dynamic.tsx` (Remove item).

## 3. Primary / create / submit → `Button`

`@/components/ui/button` (the solid CVA `Button`, usually `intent="primary"`). For form submit /
create / save — a deliberately **separate** style from the dashed AddButton affordance.

- Label create forms **"Create <noun>"** ("Creating…" while pending). Keep "Add <noun>" reserved for
  the AddButton list affordance, so the two read distinctly.
- Destructive confirmations (the actual "Delete" inside a confirm dialog) stay solid Buttons.

## Quick rules

- Every add-affordance: dashed border + leading plus + "Add <noun>". Use `AddButton`.
- Every icon-only control: `IconButton` with `aria-label`; `tone="danger"` only for delete/remove.
- Icons use `fill: currentColor` (both components set this) so they follow the text colour.
- Primary/create/save stay solid `Button`s and read "Create <noun>" / "Save …".

## Verify

```sh
docker compose exec web bunx tsc --noEmit
docker compose exec web bunx oxlint src/components src/routes
```
