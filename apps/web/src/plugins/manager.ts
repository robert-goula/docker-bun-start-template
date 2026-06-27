import { bus } from "./events";
import type { FieldControlComponent, FieldViewComponent, Plugin, PluginApi } from "./types";

/**
 * Inversion-of-control container for the plugin system. Plugins register field-control
 * components (and, via the shared `bus`, subscribe to lifecycle events) instead of being
 * wired by hand. Render sites resolve a control by key through `getFieldControl`.
 */
export class PluginManager {
  private fieldControls = new Map<string, FieldControlComponent>();
  private fieldViews = new Map<string, FieldViewComponent>();
  private registered = new Set<string>();

  register(plugin: Plugin): void {
    if (this.registered.has(plugin.name)) return;
    this.registered.add(plugin.name);
    const api: PluginApi = {
      registerFieldControl: (control, component) => this.fieldControls.set(control, component),
      registerFieldView: (control, component) => this.fieldViews.set(control, component),
      bus,
    };
    plugin.setup(api);
  }

  // Resolve a control component, falling back to `input` for an unknown/not-yet-registered
  // key — mirrors the old ternary's "else = input" so a stray control can't crash a render.
  getFieldControl(control: string): FieldControlComponent | undefined {
    return this.fieldControls.get(control) ?? this.fieldControls.get("input");
  }

  // Resolve a control's optional view-mode component. No fallback: a control without a registered
  // view uses the generic `format`/stringify path in the view renderer.
  getFieldView(control: string): FieldViewComponent | undefined {
    return this.fieldViews.get(control);
  }
}

// Module singleton: the one container the app registers built-ins into and resolves from.
export const manager = new PluginManager();
