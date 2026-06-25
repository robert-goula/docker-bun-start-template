import { type ComponentType, lazy, type LazyExoticComponent } from "react";
import type { MetaValue } from "@/lib/meta/types";

/**
 * Props every metadata-module fields editor receives: its current data and a change
 * callback. The panel owns the data; editors are controlled and stateless.
 */
export interface MetaFieldsProps {
  value: Record<string, MetaValue>;
  onChange: (next: Record<string, MetaValue>) => void;
}

/**
 * Editor components for the **extension** metadata modules, keyed by module id and lazily
 * loaded so they never enter the read-only page bundle (mirrors components/widgetRegistry).
 * The basic module (title/description) is rendered directly by PageMetaPanel — it isn't
 * here. To add an editor for a new module, register its fields component below.
 */
export const metaEditorRegistry: Record<
  string,
  LazyExoticComponent<ComponentType<MetaFieldsProps>>
> = {
  openGraph: lazy(() => import("./modules/OpenGraphFields")),
};
