import { builtinPlugins } from "./fieldControls";
import { manager } from "./manager";

let initialized = false;

// Register the committed built-in plugins exactly once. Safe to call from multiple entry points;
// `manager.register` is itself idempotent per plugin name, this guard just avoids the work.
// Experimental controls are not in `builtinPlugins` — see fieldControls/index.
export function setupPlugins(): void {
  if (initialized) return;
  initialized = true;
  for (const plugin of builtinPlugins) manager.register(plugin);
}
