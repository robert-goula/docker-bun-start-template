import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { markdownQueryOptions } from "@/server/fns/markdown";
import type { WidgetContentProps } from "@/components/Widget";
import s from "./Markdown.module.css";

/**
 * The "markdown" widget kind: shows rendered markdown and an inline editor.
 * Edit mode is toggled by the Edit control in the widget header (`editing` /
 * `onEditingChange`); Save/Cancel live with the editor. Content is stored as a
 * plain string in the widget's `content` field and saved back through
 * `onContentChange`, which the page builder persists. Rendering runs server-side
 * via `renderMarkdownFn`.
 */
export default function Markdown({
  content: rawContent,
  onContentChange,
  editing = false,
  onEditingChange,
}: WidgetContentProps) {
  const content = typeof rawContent === "string" ? rawContent : "";
  const [draft, setDraft] = useState(content);

  // Seed the draft from the saved content whenever the editor opens. `content`
  // only changes on save (which also closes the editor), so this never clobbers
  // an in-progress edit.
  useEffect(() => {
    if (editing) setDraft(content);
  }, [editing, content]);

  const { data: html } = useQuery(markdownQueryOptions(content));

  function save() {
    onContentChange?.(draft);
    onEditingChange?.(false);
  }

  function cancel() {
    setDraft(content);
    onEditingChange?.(false);
  }

  if (editing) {
    return (
      <div className={s.editor}>
        <Textarea
          aria-label="Markdown content"
          className={s.textarea}
          onChange={(e) => setDraft(e.target.value)}
          rows={12}
          value={draft}
        />
        <div className={s.actions}>
          <Button onClick={cancel} size="sm" variant="outline">
            Cancel
          </Button>
          <Button disabled={!onContentChange} intent="primary" onClick={save} size="sm">
            Save
          </Button>
        </div>
      </div>
    );
  }

  if (!content) {
    // Editable context (rendered inside the builder chrome) passes onContentChange;
    // hint at editing only there. In the read-only view, render nothing.
    return onContentChange ? (
      <p className={s.empty}>No content yet — use the edit icon above to add some markdown.</p>
    ) : null;
  }

  return (
    <div className={s.view}>
      {/* Trusted, editor-authored markdown rendered server-side by Bun.markdown. */}
      <div className={s.rendered} dangerouslySetInnerHTML={{ __html: html ?? "" }} />
    </div>
  );
}
