import type { ComponentType } from "react";
import type { CustomWidgetField } from "@/db/schema/customWidgets";
import type { Json } from "@/types/Json";
import type { EventBus } from "./events";

// Props every field-control component receives. `field` carries the full per-field config
// (required, minlength, pattern, rows, …) so a control can read whatever it needs. `value` is
// the stored value — a string for simple controls, or structured Json for compound ones (e.g.
// the measurement control's `{ [name]: decimal }`); `onChange` writes the next value.
export interface FieldControlProps {
  id: string;
  field: CustomWidgetField;
  value: Json;
  onChange: (value: Json) => void;
}

export type FieldControlComponent = ComponentType<FieldControlProps>;

// The surface a plugin's `setup` receives. Plugins register capabilities and subscribe to
// lifecycle events through here rather than reaching into the manager directly.
export interface PluginApi {
  registerFieldControl(control: string, component: FieldControlComponent): void;
  bus: EventBus;
}

// A unit of pluggable behaviour. `setup` runs once when the plugin is registered.
export interface Plugin {
  name: string;
  setup(api: PluginApi): void;
}
