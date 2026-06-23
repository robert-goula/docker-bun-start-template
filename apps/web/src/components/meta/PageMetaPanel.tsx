import { Suspense, useState } from "react";
import { defaultsForModule, getMetaModule } from "@/lib/meta/registry";
import type { PageMetaData } from "@/lib/meta/types";
import type { PageMeta } from "@/server/services/PageRepo";
import BasicFields from "./modules/BasicFields";
import { metaEditorRegistry } from "./metaEditorRegistry";
import styles from "./PageMetaPanel.module.css";

export interface PageMetaPatch {
  title?: string;
  description?: string | null;
  modules?: PageMetaData;
}

// Drops the basic module — its fields are edited as title/description, not as a module.
function extensionModules(meta: PageMeta | null): PageMetaData {
  const out: PageMetaData = {};
  for (const [id, data] of Object.entries(meta?.modules ?? {})) {
    if (id !== "basic") out[id] = data;
  }
  return out;
}

/**
 * In-edit-mode metadata editor for the page being viewed (locale + slug are implicit in
 * the route). Basic SEO fields are always shown; each registered extension module gets a
 * collapsible section. Edits are buffered locally and persisted on blur (a single bubbled
 * onBlur covers every field), so the page `<head>` updates without per-keystroke writes.
 */
export default function PageMetaPanel({
  meta,
  onSave,
}: {
  meta: PageMeta | null;
  onSave: (patch: PageMetaPatch) => void;
}) {
  const [title, setTitle] = useState(meta?.meta.title ?? "");
  const [description, setDescription] = useState(meta?.meta.description ?? "");
  const [modules, setModules] = useState<PageMetaData>(() => extensionModules(meta));

  // Persist current state. Title maps to a NOT NULL column, so an empty title is omitted
  // (the existing value is kept) rather than sent and rejected.
  const commit = () => {
    const patch: PageMetaPatch = {
      description: description.trim() === "" ? null : description,
      modules,
    };
    if (title.trim() !== "") patch.title = title;
    onSave(patch);
  };

  return (
    <section className={styles.panel} onBlur={commit} aria-label="Page metadata">
      <h3 className={styles.heading}>Page metadata</h3>

      <BasicFields
        title={title}
        description={description}
        onTitleChange={setTitle}
        onDescriptionChange={setDescription}
      />

      {Object.entries(metaEditorRegistry).map(([id, Fields]) => (
        <details key={id} className={styles.module}>
          <summary className={styles.moduleSummary}>{getMetaModule(id)?.label ?? id}</summary>
          <div className={styles.moduleBody}>
            <Suspense fallback={null}>
              <Fields
                value={modules[id] ?? defaultsForModule(id)}
                onChange={(next) => setModules((m) => ({ ...m, [id]: next }))}
              />
            </Suspense>
          </div>
        </details>
      ))}
    </section>
  );
}
