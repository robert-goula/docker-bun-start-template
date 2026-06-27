import { mutationOptions, queryOptions } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
import type { ConfigId } from "@/db/schema/config";
import {
  getConfigFn,
  listConfigFn,
  removeConfigFn,
  type SafeConfig,
  setConfigFn,
} from "@/server/fns/config";

export const configKeys = {
  all: ["config"] as const,
  list: () => [...configKeys.all, "list"] as const,
  byId: (id: ConfigId) => [...configKeys.all, "byId", id] as const,
};

// One config entry write — `set` upserts by id (create or update share the same path).
export interface SetConfigVars {
  id: ConfigId;
  value: unknown;
  description?: string | null;
}

export const configRepo = {
  list: () =>
    queryOptions({
      queryKey: configKeys.list(),
      queryFn: ({ signal }) => listConfigFn({ signal }),
    }),

  byId: (id: ConfigId) =>
    queryOptions({
      queryKey: configKeys.byId(id),
      queryFn: ({ signal }) => getConfigFn({ data: { id }, signal }),
    }),

  set: (qc: QueryClient) =>
    mutationOptions({
      mutationFn: (vars: SetConfigVars) => setConfigFn({ data: vars }),
      onSuccess: (saved: SafeConfig) => {
        qc.setQueryData(configKeys.byId(saved.id), saved);
        qc.invalidateQueries({ queryKey: configKeys.list() });
      },
    }),

  remove: (qc: QueryClient) =>
    mutationOptions({
      mutationFn: (id: ConfigId) => removeConfigFn({ data: { id } }),
      onSuccess: () => qc.invalidateQueries({ queryKey: configKeys.all }),
    }),
};
