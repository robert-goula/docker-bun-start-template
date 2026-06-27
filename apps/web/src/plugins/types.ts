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

// Props a field-VIEW component receives (view mode on public pages). A view is optional and only
// needed when the stored value isn't directly presentable and the React-free `format` hook can't
// produce the display text — e.g. a control storing an id whose label must be fetched/localized at
// render. `field` is the PUBLIC render projection's field shape (a minimal structural subset, not
// the full `CustomWidgetField`), so it carries only public-safe config the view needs.
export interface FieldViewProps {
  field: {
    control: string;
    repeatable?: boolean;
    taxonomyId?: string;
  };
  value: Json;
}

export type FieldViewComponent = ComponentType<FieldViewProps>;

// The surface a plugin's `setup` receives. Plugins register capabilities and subscribe to
// lifecycle events through here rather than reaching into the manager directly.
export interface PluginApi {
  registerFieldControl(control: string, component: FieldControlComponent): void;
  // Optional view-mode renderer for a control (see FieldViewProps). Controls without one fall
  // back to the descriptor's `format` hook / plain stringification in the generic view.
  registerFieldView(control: string, component: FieldViewComponent): void;
  bus: EventBus;
}

// A unit of pluggable behaviour. `setup` runs once when the plugin is registered.
export interface Plugin {
  name: string;
  setup(api: PluginApi): void;
}
