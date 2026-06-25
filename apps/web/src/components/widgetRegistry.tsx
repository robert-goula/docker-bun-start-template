import { type ComponentType, lazy, type LazyExoticComponent } from "react";
import type { WidgetContentProps, WidgetKind } from "@/components/Widget";

// Kinds whose content component supports inline editing. The page builder shows
// an Edit control in the widget header for these and drives their `editing` prop.
// The menu widget's edit mode is just its bind picker (which menu to render).
export const editableWidgetKinds = new Set<WidgetKind>(["markdown", "dynamic", "menu"]);

// Kinds that only exist while editing — the read-only page view skips them
// entirely (no wrapper, no chrome), so they are completely hidden in view mode.
export const editOnlyWidgetKinds = new Set<WidgetKind>(["debug"]);

const registry: Record<WidgetKind, LazyExoticComponent<ComponentType<WidgetContentProps>>> = {
  markdown: lazy(() => import("@/components/widgets/Markdown")),
  debug: lazy(() => import("@/components/widgets/Debug")),
  dynamic: lazy(() => import("@/components/widgets/Dynamic")),
  menu: lazy(() => import("@/components/widgets/Menu")),
};

// Kinds offered when adding a widget. The other registry kinds remain renderable
// (e.g. seeded/style-guide widgets) but aren't addable yet.
export const widgetKindList: WidgetKind[] = ["markdown", "menu", "debug"];

export default registry;
