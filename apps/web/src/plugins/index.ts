import { manager } from "./manager";
import { setupPlugins } from "./setup";
import type { FieldControlComponent, FieldViewComponent } from "./types";

// Public entry for resolving a field control. Ensures built-ins are registered before the
// first lookup, so call sites don't have to bootstrap the plugin system themselves.
export function getFieldControl(control: string): FieldControlComponent | undefined {
  setupPlugins();
  return manager.getFieldControl(control);
}

// Public entry for resolving a control's optional view-mode component (undefined when none).
export function getFieldView(control: string): FieldViewComponent | undefined {
  setupPlugins();
  return manager.getFieldView(control);
}

export { bus } from "./events";
export { setupPlugins } from "./setup";
export { manager } from "./manager";
export type { AppEvents } from "./events";
export type { FieldControlProps, FieldViewProps, Plugin, PluginApi } from "./types";
