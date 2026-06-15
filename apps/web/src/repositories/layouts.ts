import { mutationOptions, queryOptions } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
import type { LayoutId } from "@/db/schema/layouts";
import {
  createLayoutFn,
  getLayoutByIdFn,
  listLayoutsFn,
  type SafeLayoutDetail,
  type UpdateLayoutAttributes,
} from "@/server/fns/layouts";

const JSON_API = "application/vnd.api+json";

// Sends only the changed attributes as a JSON:API PATCH to the layouts endpoint,
// which calls updateLayoutFn to apply the patch via the repo.
async function patchLayout(id: LayoutId, patch: UpdateLayoutAttributes): Promise<SafeLayoutDetail> {
  const res = await fetch(`/api/layouts/${id}`, {
    method: "PATCH",
    headers: { "content-type": JSON_API, accept: JSON_API },
    body: JSON.stringify({ data: { type: "layout", id, attributes: patch } }),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const detail = json?.errors?.[0]?.detail ?? json?.errors?.[0]?.title;
    throw new Error(detail ?? `Failed to update layout (${res.status})`);
  }
  return json.data.attributes as SafeLayoutDetail;
}

export const layoutsKeys = {
  all: ["layouts"] as const,
  list: () => [...layoutsKeys.all, "list"] as const,
  byId: (id: LayoutId) => [...layoutsKeys.all, "byId", id] as const,
};

export const layoutsRepo = {
  list: () =>
    queryOptions({
      queryKey: layoutsKeys.list(),
      queryFn: ({ signal }) => listLayoutsFn({ signal }),
    }),

  byId: (id: LayoutId) =>
    queryOptions({
      queryKey: layoutsKeys.byId(id),
      queryFn: ({ signal }) => getLayoutByIdFn({ data: { id }, signal }),
    }),

  create: (qc: QueryClient) =>
    mutationOptions({
      mutationFn: (input: { name: string; description?: string | null }) =>
        createLayoutFn({ data: input }),
      onSuccess: () => qc.invalidateQueries({ queryKey: layoutsKeys.all }),
    }),

  update: (qc: QueryClient) =>
    mutationOptions({
      mutationFn: ({ id, patch }: { id: LayoutId; patch: UpdateLayoutAttributes }) =>
        patchLayout(id, patch),
      onSuccess: (_layout, { id }) => {
        qc.invalidateQueries({ queryKey: layoutsKeys.byId(id) });
        qc.invalidateQueries({ queryKey: layoutsKeys.all });
      },
    }),
};
