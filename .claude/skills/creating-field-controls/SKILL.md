---
name: creating-field-controls
description: Add a new field-type control (input widget) to the Custom Widgets plugin system — registry descriptor, client React control, plugin registration, per-control config, and optional view formatting. Use when adding a control like number / date / color / a compound control, or when extending a control's builder config or view display.
---

# Creating a Field Control

The Custom Widgets system renders each field with a pluggable **control**, resolved at runtime
through an IoC registry (`getFieldControl(control)` → a React component). Each control is **one
self-contained module** under `apps/web/src/plugins/fieldControls/<control>.tsx` exporting three
things — the component, its descriptor, and its plugin — composed in `fieldControls/index.ts`:

| Layer (all in the control's module) | What it is | Rule |
| --- | --- | --- |
| **Component** (client React) | The `<input>`/UI. Implements `FieldControlProps`. | — |
| **Descriptor** (`FieldControlDescriptor`) | The control *key*, builder label, advanced config, optional view `format`. | Built from `./shared` types. Used by the builder + view, **not** the server schema. |
| **Plugin** (`Plugin`) | `setup(api)` calls `api.registerFieldControl(key, Component)` — and, optionally, `api.registerFieldView(key, ViewComponent)` for a React view (below). | Added to `builtinPlugins` in `index.ts`. |

Supporting files (don't duplicate their contents into a control module):

- `fieldControls/keys.ts` — **React-free.** The `fieldControls` key tuple + small shared config
  types/defaults (`MeasureConfig`, `defaultMeasures`). **The server schema imports only this** — keep
  it free of React and component imports.
- `fieldControls/shared.ts` — React-free helpers/types every control uses: `asStr`,
  `AdvancedFieldSpec`, `FieldFormatContext`, `FieldControlDescriptor`.
- `fieldControls/index.ts` — composes `fieldControlDescriptors` (builder dropdown order) +
  `builtinPlugins` (what `setup.ts` registers), and re-exports the client-facing barrel.

**Canonical references — read these and mirror them:**

- Simple control module: `fieldControls/input.tsx` (and `textarea.tsx` / `number.tsx`).
- Compound + parked control: `plugins/extra/measurement.tsx` (structured value, named sub-fields,
  view formatter — and the worked example of a **parked** control: see below).
- Data-backed control with a **React view** + a **bespoke dynamic builder input**:
  `plugins/fieldControls/select.tsx` (the taxonomy-backed `select` control — stores an id, resolves
  the localized label at view time via `registerFieldView`; its builder config is a live taxonomy
  picker, not a static select).
- Per-field config: `customWidgetFieldSchema` in `apps/web/src/db/schema/customWidgets.ts`.
- Edit/view dispatch: `DynamicField`, `RepeatableField`, `DynamicView` in `apps/web/src/components/widgets/Dynamic.tsx`.
- Builder UI (driven by descriptors): `apps/web/src/components/CustomWidgetFieldsBuilder.tsx`.

**Parking a not-yet-committed control:** put its module under `plugins/extra/` and **don't** add its
descriptor/plugin to `fieldControls/index.ts` (so it's unregistered and absent from the builder).
Because its key isn't in the committed `keys.ts` tuple, the module can't use the shared
`FieldControlDescriptor` (whose `control` is typed `FieldControl`) — give it a **local descriptor
type** with `control: string`, and don't rely on builder-only `inputType`s. `measurement.tsx` is the
worked example. ⚠️ A parked control only stays inert while **no stored field uses its key** — if one
does, `getFieldControl` falls back to the input control and the view stringifies the value to
`[object Object]`.

## The value contract — read this first

A field value flows end-to-end as **`Json`** (`@/types/Json`): the editor draft is
`Record<string, Json>`; a control receives `value: Json` and emits `onChange(value: Json)`; the
instance persists the `{ fieldName: value }` map into `content` jsonb as-is.

- **Simple controls work in strings.** Coerce on read with a local `asStr(value)` helper (see
  `InputControl`/`NumberControl`) and emit `e.target.value`. A string is valid `Json`, so storage
  stays a plain string (`{ "title": "Hello" }`).
- **Compound controls store structured Json** keyed by stable machine names — never a hand-rolled
  delimited string. The measurement control stores `{ [measureName]: decimal }` (e.g.
  `{ "left": "5.375", "right": "2.25" }`), decoding/encoding the object inside the component.
- **Repetition is framework-level** (`RepeatableField`) and stores a **native array** of per-instance
  values — `[{ left, right }, …]`, not a JSON-stringified blob. The control stays repeat-unaware.

## Steps

### 1. Register the key — `fieldControls/keys.ts` (React-free)

Add the key to the tuple: `export const fieldControls = ["input", …, "myControl"] as const;`. This
narrows `z.enum(fieldControls)` in the schema and types every descriptor's `control`. Keep this file
free of React/component imports — the server schema imports it.

### 2. Control module — `fieldControls/myControl.tsx`

One file exporting the component, descriptor, and plugin. Implement `FieldControlProps`
(`{ id, field, value, onChange }`; `value`/`onChange` are `Json`). Read per-field config off
`field.*` (the full `CustomWidgetField`); use `asStr` from `./shared` for string-valued controls.
Style with a CSS module + `var(--…)` tokens, not Tailwind for component styling.

```tsx
import { asStr, type FieldControlDescriptor } from "./shared";
import type { FieldControlProps, Plugin } from "../types";

export function MyControl({ id, field, value, onChange }: FieldControlProps) {
  return <Input id={id} value={asStr(value)} onChange={(e) => onChange(e.target.value)} required={field.required} />;
}

export const myControlDescriptor: FieldControlDescriptor = {
  control: "myControl",
  label: "Human label (builder dropdown)",
  advancedFields: [ /* see Builder config below */ ],
  // format: (value, field) => …  // optional view-mode display string
};

export const myControlPlugin: Plugin = {
  // Convention: the plugin `name` IS the control key. It's only an internal dedup id (the
  // `PluginManager.registered` set), but matching the key keeps one vocabulary — `plugins.enabled`
  // and the builder gate compare against control keys, so a divergent name would be invisible there.
  name: "myControl",
  setup(api) { api.registerFieldControl("myControl", MyControl); },
};
```

For a compound control, treat `value` as a structured object keyed by stable names and emit the
updated object — see `extra/measurement.tsx` (`{ [measureName]: decimal }`). Config that is itself a
list of named/labeled sub-parts belongs in the schema as an array (e.g. `measures`), not as
`thing1`/`thing2` props.

### 3. Compose it — `fieldControls/index.ts`

Add the descriptor to `fieldControlDescriptors` (builder-dropdown order) and the plugin to
`builtinPlugins` (what `setup.ts` registers):

```ts
import { myControlDescriptor, myControlPlugin } from "./myControl";
// fieldControlDescriptors: [ …, myControlDescriptor ]
// builtinPlugins:          [ …, myControlPlugin ]
```

`setup.ts` needs no change — it just loops `builtinPlugins`.

### 4. Per-control config — `customWidgets.ts`

Anything the control or builder needs beyond the shared props (required/min/maxlength/placeholder/
default/description) is an **optional** prop on `customWidgetFieldSchema`, mirroring `rows` / `min` /
`precision`:

```ts
myOption: z.string().max(40).optional(),
```

Add cross-field rules to the existing `.superRefine(...)` if needed. The control reads it as
`field.myOption`.

### 5. Builder config — automatic, descriptor-driven

The builder renders control-specific inputs from the active descriptor's `advancedFields`
(`AdvancedFieldSpec`). You usually write **zero** builder code — just declare specs in step 1:

- `inputType: "text" | "number"` → a text/number `<Input>` (`min`/`max`/`step`/`placeholder`).
- `inputType: "select"` → a `<select>` from `options: [{ value, label }]`. A blank "—" option is
  added automatically so the value stays optional (clears to `undefined`); number-valued options are
  coerced back to numbers.
- `inputType: "measures"` → the bespoke named/labeled sub-measurement editor (a builder branch, not a
  generic input). A genuinely structured config input like this needs its own builder branch +
  component (`MeasuresEditor`); reuse the pattern if you add another structured config type.
- `key` is the `CustomWidgetField` prop it edits; `width` is `"¼" | "½" | "full"`.

**Bespoke / dynamic builder input** (when a static `options` list won't do — e.g. the choices are
fetched live, or the input creates a record): add a new `inputType` literal to `AdvancedFieldSpec`
in `shared.ts` and a matching branch in `CustomWidgetFieldsBuilder`'s `advancedFields.map`, rendering
your own component that calls `onChange({ [spec.key]: value })`. The `select` control's
`taxonomyParent` input is the worked example: the branch renders `<TaxonomyParentPicker>` (exported
from the control module), which lists taxonomies via a query and can create one inline, writing
`field.taxonomyId`.

### 6. View formatting (only if the raw stored value isn't presentable)

`DynamicView` shows the descriptor's `format(value, field)` if present, else `asString(value)`. The
`format` hook is **React-free** (`(value: Json, field: FieldFormatContext) => string`; the context is
a minimal structural shape — not `CustomWidgetField`) so it runs during SSR. It may return a
**multi-line** string, rendered with `white-space: pre-line` (see the measurement control's stacked
`label: value` rows). If `format` (or repeat/compound view) needs a config prop, that prop must also
be added to the **public render projection** `renderCustomWidgetSchema` in `customWidgets.ts` — it's a
`z.object` that strips unknown keys, so a value only reaches view mode if it's listed there. Keep the
projection public-safe (no validation/defaults/helper text).

### 6b. React view (when `format` can't produce the display text)

`format` is **React-free and synchronous** — it can't fetch or use hooks. If a control stores a
reference whose display text must be **fetched or localized at render** (e.g. the `select` control
stores a taxonomy id, not its label), register a **React view component** instead:

- Export a component implementing `FieldViewProps` (`{ field, value }`, where `field` is the
  PUBLIC render-projection shape — a minimal structural subset, **not** `CustomWidgetField`) and
  register it in the plugin's `setup`: `api.registerFieldView(key, ViewComponent)`.
- `DynamicView` prefers a registered view (`getFieldView(field.control)`) over the `format`/string
  path. It renders the component inside the `<Field>` wrapper and skips the field when the **raw**
  stored value is empty (so empties still drop out). Return `null` from the view when there's
  nothing to show.
- Any config the view reads (e.g. `taxonomyId`) must be added to **`renderCustomWidgetSchema`** —
  the projection strips unknown keys, so a value only reaches the view if it's listed there.
- The view runs during SSR; without a loader prefetch its query resolves on the client after
  hydration (server renders `null`, client's first render also has no data → no mismatch). Prefetch
  in the page loader if you need a flash-free server-rendered label.

## Repeatable fields (already generic — do nothing per control)

`repeatable` / `minItems` / `maxItems` (capped at `repeatItemsCap = 20`) are framework-level and work
for **every** control via `RepeatableField`, which stores a **native array** of per-instance values
(strings or structured objects) and manages Add/Remove. A control stays unaware of repetition. Don't
reimplement it.

**Opting out — `selfRepeats`:** a control whose natural "allow multiple" UX is a single widget (e.g.
a native multi-select) sets `selfRepeats: true` on its descriptor. `DynamicField` then renders the
control **directly** (not wrapped in `RepeatableField`) even when `field.repeatable` is true; the
control receives the **array** value, branches on `field.repeatable`, and stores the same native
array shape (so the view + stored data are identical to the generic path). The `select` control is
the worked example (single-select string vs. multi-select array). `minItems`/`maxItems` don't apply
to a `selfRepeats` control.

## Gotchas (each cost real time)

- **`z.boolean().default(false)` is required in the inferred output type.** Adding a defaulted bool
  (like `repeatable`) to the schema breaks the `makeField(...)` factory in the builder until you add
  the property there too. Same for any new defaulted field.
- **Keep `keys.ts` and `shared.ts` free of React.** The server schema imports `keys.ts`; a React
  import there pulls components into the server bundle (and risks a cycle). Control components live in
  per-control `.tsx` modules; only `index.ts` (client-only) imports those. The `format` hook uses
  `FieldFormatContext`, not `CustomWidgetField`, for the same React-free reason.
- **The schema imports the key tuple from `keys.ts`, not the rich descriptors.** `customWidgets.ts`
  needs `import { fieldControls } from "@/plugins/fieldControls/keys"` to use it in `z.enum(...)`.
- **`getFieldControl` returns `FieldControlComponent | undefined`** (it falls back to `input` for
  unknown keys, but type it as optional at call sites).
- **Native `min`/`max`/`step` only constrain the spinner and form validity, not typed input.** For
  numeric controls, normalize (clamp/round) in an `onBlur` handler — see `NumberControl`.
- **The value contract is `Json`, not `string`.** Simple controls must coerce on read (`asStr`);
  don't assume `value.trim()` exists. Compound controls store structured Json (objects/arrays) — never
  a delimited or `JSON.stringify`-ed string. An empty value must round-trip to an empty UI so
  `DynamicView` drops it (its "filled" check formats then trims).
- **Use machine `name` + display `label` for structured sub-fields** (mirroring the field's own
  name/label). The `name` is the JSON key in stored content; the `label` is display-only. Keep storage
  keys stable when a label is renamed.

## Verify

Run inside the container (host JS is policy-blocked). Use the plain `bunx` form — wrapping it in
`sh -lc '…bunx…'` trips the host-JS hook:

```sh
docker compose exec web bunx tsc --noEmit
docker compose exec web bunx oxlint src/plugins src/components/widgets/Dynamic.tsx src/components/CustomWidgetFieldsBuilder.tsx src/db/schema/customWidgets.ts
```

Scope `oxlint` to changed files/dirs — the unscoped `bun run lint` script also scans `node_modules`.
Then manually: in the field builder, the new control appears in the dropdown with its label and its
`advancedFields`; editing + saving a dynamic instance round-trips the value; view mode shows the
formatted (or raw) output.
