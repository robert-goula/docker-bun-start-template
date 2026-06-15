import { type ComponentType, lazy, type LazyExoticComponent } from "react";
import type { WidgetContentProps, WidgetKind } from "@/components/Widget";

// Kinds whose content component supports inline editing. The page builder shows
// an Edit control in the widget header for these and drives their `editing` prop.
export const editableWidgetKinds = new Set<WidgetKind>(["markdown"]);

// Kinds that only exist while editing — the read-only page view skips them
// entirely (no wrapper, no chrome), so they are completely hidden in view mode.
export const editOnlyWidgetKinds = new Set<WidgetKind>(["debug"]);

// Each kind renders its own content component. Static demo widgets ignore the
// props; editable kinds (e.g. "markdown") consume `options`/`onOptionsChange`.
const registry: Record<WidgetKind, LazyExoticComponent<ComponentType<WidgetContentProps>>> = {
  // alerts: lazy(() => import("./-examples/Alerts")),
  // badges: lazy(() => import("./-examples/Badges")),
  // buttons: lazy(() => import("./_examples/Buttons")),
  // cards: lazy(() => import("./_examples/Cards")),
  // fields: lazy(() => import("./_examples/Fields")),
  // headers: lazy(() => import("./_examples/Headers")),
  markdown: lazy(() => import("@/components/widgets/Markdown")),
  debug: lazy(() => import("@/components/widgets/Debug")),
  // tabsHorizontal: lazy(() => import("./_examples/TabsHorizontal")),
  // tabsVertical: lazy(() => import("./_examples/TabsVertical")),
  // example: lazy(() =>
  //   Promise.resolve({
  //     default: function Intro() {
  //       return <p>Functional Example.</p>;
  //     },
  //   }),
  // ),
};

// Kinds offered when adding a widget. The other registry kinds remain renderable
// (e.g. seeded/style-guide widgets) but aren't addable yet.
export const widgetKindList: WidgetKind[] = ["markdown", "debug"];

export default registry;
