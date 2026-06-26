import { numberFieldPlugin, textFieldsPlugin } from "./builtin";
import { manager } from "./manager";

let initialized = false;

// Register the built-in plugins exactly once. Safe to call from multiple entry points;
// `manager.register` is itself idempotent per plugin name, this guard just avoids the work.
export function setupPlugins(): void {
  if (initialized) return;
  initialized = true;
  manager.register(textFieldsPlugin);
  manager.register(numberFieldPlugin);
}
