import { manager } from "./manager";
import { setupPlugins } from "./setup";
import type { FieldControlComponent } from "./types";

// Public entry for resolving a field control. Ensures built-ins are registered before the
// first lookup, so call sites don't have to bootstrap the plugin system themselves.
export function getFieldControl(control: string): FieldControlComponent | undefined {
  setupPlugins();
  return manager.getFieldControl(control);
}

export { bus } from "./events";
export { setupPlugins } from "./setup";
export { manager } from "./manager";
export type { AppEvents } from "./events";
export type { FieldControlProps, Plugin, PluginApi } from "./types";
