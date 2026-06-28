import { Suspense, useId, useRef, useState } from "react";
import { cx } from "class-variance-authority";
import { ArrowDropDownIcon } from "@/components/icons";
import { Field, FieldBody, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { defaultsForModule, getMetaModule } from "@/lib/meta/registry";
import type { PageMetaData } from "@/lib/meta/types";
import type { PageMeta } from "@/server/services/PageRepo";
import BasicFields from "./modules/BasicFields";
import { metaEditorRegistry } from "./metaEditorRegistry";
import styles from "./PageMetaPanel.module.css";

export interface PageMetaPatch {
  slug?: string;
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
  const [open, setOpen] = useState(false);
  const contentId = useId();
  const [slug, setSlug] = useState(meta?.canonicalSlug ?? "");
  const [title, setTitle] = useState(meta?.meta.title ?? "");
  const [description, setDescription] = useState(meta?.meta.description ?? "");
  const [modules, setModules] = useState<PageMetaData>(() => extensionModules(meta));

  // Route-owned page: the slug is fixed by the file route and there's no SEO, so the editor
  // shows only the per-locale title (slug/description/modules are hidden and never written).
  const system = meta?.system ?? false;

  // The single bubbled onBlur fires on every focus-out, so only persist when something
  // actually changed since the last commit — otherwise tabbing through the fields would
  // re-save (and re-toast) unchanged data. Seeded from the initial state on first render.
  const lastCommitted = useRef<string | null>(null);
  const snapshot = () => JSON.stringify({ slug, title, description, modules });
  if (lastCommitted.current === null) lastCommitted.current = snapshot();

  // Persist current state. Title/slug map to NOT NULL columns, so an empty value is omitted
  // (the existing one is kept) rather than sent and rejected. A changed slug renames the
  // page's URL for this locale; the parent navigates there after the save resolves.
  const commit = () => {
    const current = snapshot();
    if (current === lastCommitted.current) return;
    lastCommitted.current = current;

    // System pages only carry a per-locale title; never send slug/description/modules.
    if (system) {
      if (title.trim() !== "") onSave({ title });
      return;
    }

    const patch: PageMetaPatch = {
      description: description.trim() === "" ? null : description,
      modules,
    };
    if (title.trim() !== "") patch.title = title;
    if (slug.trim() !== "") patch.slug = slug;
    onSave(patch);
  };

  return (
    <section className={styles.panel} aria-label="Page metadata">
      <header className={styles.header}>
        <button
          type="button"
          className={styles.toggle}
          aria-expanded={open}
          aria-controls={contentId}
          onClick={() => setOpen((o) => !o)}
        >
          <span className={cx(styles.indicator, !open && styles.collapsed)}>
            <ArrowDropDownIcon aria-hidden="true" />
          </span>
          <span className={styles.title}>{system ? "Page title" : "Page metadata"}</span>
        </button>
      </header>

      {/* A single bubbled onBlur persists every field; the editors stay controlled. */}
      <div id={contentId} className={styles.content} hidden={!open} onBlur={commit}>
        {!system && (
          <Field>
            <FieldLabel htmlFor="meta-slug">Slug</FieldLabel>
            <FieldBody>
              <Input
                id="meta-slug"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                required
              />
              <FieldDescription>
                The URL path for this locale (e.g. <code>/about</code>). Renaming changes the page
                address.
              </FieldDescription>
            </FieldBody>
          </Field>
        )}

        <BasicFields
          title={title}
          description={description}
          onTitleChange={setTitle}
          onDescriptionChange={setDescription}
          hideDescription={system}
        />

        {!system &&
          Object.entries(metaEditorRegistry).map(([id, Fields]) => (
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
      </div>
    </section>
  );
}
