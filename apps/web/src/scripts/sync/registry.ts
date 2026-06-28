import type { SyncResource } from "./types";
import { configResource } from "./resources/config";
import { customWidgetResource } from "./resources/customWidget";
import { layoutResource } from "./resources/layout";
import { menuResource } from "./resources/menu";
import { pageResource } from "./resources/page";
import { taxonomyResource } from "./resources/taxonomy";

// Every round-trippable kind. Import runs in ascending `order` (config -> taxonomy ->
// custom-widget -> menu -> layout -> page) so soft cross-references resolve. Add a kind here
// and the export/import drivers pick it up with no other change.
export const syncResources: readonly SyncResource[] = [
  configResource,
  taxonomyResource,
  customWidgetResource,
  menuResource,
  layoutResource,
  pageResource,
];

export const getResource = (kind: string): SyncResource | undefined =>
  syncResources.find((r) => r.kind === kind);
