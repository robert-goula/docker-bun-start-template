import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import * as z from "zod";

/**
 * Renders a markdown string to HTML using Bun's built-in markdown renderer.
 * Runs on the server because `Bun.markdown` is a runtime API and is not
 * available in the browser bundle. Callers cache by content (the markdown
 * string) so a render only happens when the saved content changes.
 *
 * NOTE: output is rendered with `dangerouslySetInnerHTML`; the renderer passes
 * raw inline HTML through. Content here is authored by trusted page editors.
 */
export const renderMarkdownFn = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.string().parse(input))
  .handler(({ data }) => Bun.markdown.html(data, { headings: { ids: true } }));

/**
 * Query options for a markdown widget's rendered HTML, keyed by content. Shared
 * by the widget (useQuery) and the route loader (prefetch) so the view can be
 * server-rendered with content via the SSR query integration.
 */
export const markdownQueryOptions = (content: string) =>
  queryOptions({
    queryKey: ["markdown", content],
    queryFn: () => renderMarkdownFn({ data: content }),
    enabled: content.length > 0,
  });
