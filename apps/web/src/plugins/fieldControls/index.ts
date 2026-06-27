// Composes the committed built-in controls: the descriptor list that drives the builder dropdown
// and view formatting, plus the plugins that register their components. This is the client-facing
// barrel — the server schema imports the React-free `./keys` directly, never this file.
//
// Extra / not-yet-committed controls (e.g. `../extra/measurement`) are intentionally
// absent here. To enable one, add its descriptor to `fieldControlDescriptors` and its plugin to
// `builtinPlugins`. NOTE: only park a control once no field uses its key — an unregistered control
// falls back to the input control and its stored value renders as "[object Object]".

import { inputDescriptor, inputPlugin } from "./input";
import { numberDescriptor, numberPlugin } from "./number";
import { selectDescriptor, selectPlugin } from "./select";
import { textareaDescriptor, textareaPlugin } from "./textarea";
import type { FieldControl } from "./keys";
import type { FieldControlDescriptor } from "./shared";
import type { Plugin } from "../types";

// Demo lifecycle listener: proves the `bus.on`/`trigger` path works end to end. Replace or remove
// once a real consumer exists. Kept separate from the control plugins since it's cross-cutting.
const lifecycleDemoPlugin: Plugin = {
  name: "lifecycle-demo",
  setup(api) {
    api.bus.on("widget:save", ({ definitionId, values }) => {
      console.debug("[plugins] widget:save", definitionId, values);
    });
  },
};

// The committed built-in plugins, registered by `setupPlugins`.
export const builtinPlugins: ReadonlyArray<Plugin> = [
  inputPlugin,
  textareaPlugin,
  numberPlugin,
  selectPlugin,
  lifecycleDemoPlugin,
];

// The committed control descriptors, in builder-dropdown order.
export const fieldControlDescriptors: ReadonlyArray<FieldControlDescriptor> = [
  inputDescriptor,
  textareaDescriptor,
  numberDescriptor,
  selectDescriptor,
];

// Lookup by key. Partial in practice — keys without a committed descriptor (e.g. "measurement")
// resolve to undefined, so callers use optional access.
export const fieldControlDescriptorByKey = Object.fromEntries(
  fieldControlDescriptors.map((d) => [d.control, d]),
) as Record<FieldControl, FieldControlDescriptor>;

// Maps a control key to its registering plugin's name. Lets config that gates controls (e.g.
// `plugins.enabled`) accept either identifier — the control key ("input") or the plugin name
// ("input-field") — and resolve both to the same control. Keep in sync when adding a control.
export const fieldControlPluginNames: Record<FieldControl, string> = {
  input: inputPlugin.name,
  textarea: textareaPlugin.name,
  number: numberPlugin.name,
  select: selectPlugin.name,
};

export { defaultMeasures, fieldControls } from "./keys";
export type { FieldControl, MeasureConfig } from "./keys";
export type {
  AdvancedFieldOption,
  AdvancedFieldSpec,
  FieldControlDescriptor,
  FieldFormatContext,
} from "./shared";
