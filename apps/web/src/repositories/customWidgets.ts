import { mutationOptions, queryOptions } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
import type { CustomWidgetId } from "@/db/schema/customWidgets";
import {
  createCustomWidgetFn,
  deleteCustomWidgetFn,
  getCustomWidgetByIdFn,
  listCustomWidgetsFn,
  type UpdateCustomWidgetAttributes,
  updateCustomWidgetFn,
} from "@/server/fns/customWidgets";

export const customWidgetsKeys = {
  all: ["customWidgets"] as const,
  list: () => [...customWidgetsKeys.all, "list"] as const,
  byId: (id: CustomWidgetId) => [...customWidgetsKeys.all, "byId", id] as const,
};

export const customWidgetsRepo = {
  list: () =>
    queryOptions({
      queryKey: customWidgetsKeys.list(),
      queryFn: ({ signal }) => listCustomWidgetsFn({ signal }),
    }),

  byId: (id: CustomWidgetId) =>
    queryOptions({
      queryKey: customWidgetsKeys.byId(id),
      queryFn: ({ signal }) => getCustomWidgetByIdFn({ data: { id }, signal }),
    }),

  create: (qc: QueryClient) =>
    mutationOptions({
      mutationFn: (input: { name: string; description?: string | null }) =>
        createCustomWidgetFn({ data: input }),
      onSuccess: () => qc.invalidateQueries({ queryKey: customWidgetsKeys.all }),
    }),

  update: (qc: QueryClient) =>
    mutationOptions({
      mutationFn: ({ id, patch }: { id: CustomWidgetId; patch: UpdateCustomWidgetAttributes }) =>
        updateCustomWidgetFn({ data: { id, patch } }),
      onSuccess: (updated, { id }) => {
        qc.setQueryData(customWidgetsKeys.byId(id), updated);
        qc.invalidateQueries({ queryKey: customWidgetsKeys.list() });
      },
    }),

  remove: (qc: QueryClient) =>
    mutationOptions({
      mutationFn: (id: CustomWidgetId) => deleteCustomWidgetFn({ data: { id } }),
      onSuccess: () => qc.invalidateQueries({ queryKey: customWidgetsKeys.all }),
    }),
};
