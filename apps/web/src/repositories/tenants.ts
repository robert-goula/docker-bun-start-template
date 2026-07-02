import { mutationOptions, queryOptions } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
import type * as z from "zod";
import {
  selectTenantSchema,
  type InsertTenantInput,
  type ListTenantsPagedMeta,
  type ListTenantsParams,
  type TenantId,
  type UpdateTenantInput,
} from "@/db/schema/tenants";
import {
  createTenantFn,
  getTenantByIdFn,
  listTenantsFn,
  permanentDeleteTenantFn,
  restoreTenantFn,
  softDeleteTenantFn,
} from "@/server/fns/tenants";

export type SafeTenant = z.infer<typeof selectTenantSchema>;
export type { ListTenantsPagedMeta };

const JSON_API = "application/vnd.api+json";

// Sends only the changed fields as a JSON:API PATCH to the tenants endpoint, which
// in turn calls updateTenantFn to apply the patch via the repo.
async function patchTenant(id: TenantId, patch: UpdateTenantInput): Promise<SafeTenant> {
  const res = await fetch(`/api/tenants/${id}`, {
    method: "PATCH",
    headers: { "content-type": JSON_API, accept: JSON_API },
    body: JSON.stringify({ data: { type: "tenant", id, attributes: patch } }),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const detail = json?.errors?.[0]?.detail ?? json?.errors?.[0]?.title;
    throw new Error(detail ?? `Failed to update tenant (${res.status})`);
  }
  return json.data.attributes as SafeTenant;
}

export const tenantsKeys = {
  all: ["tenants"] as const,
  list: (params?: ListTenantsParams) => [...tenantsKeys.all, "list", params ?? {}] as const,
  byId: (id: TenantId) => [...tenantsKeys.all, "byId", id] as const,
};

export const tenantsRepo = {
  byId: (id: TenantId) =>
    queryOptions({
      queryKey: tenantsKeys.byId(id),
      queryFn: ({ signal }) => getTenantByIdFn({ data: { id }, signal }),
    }),

  list: (params: ListTenantsParams) =>
    queryOptions({
      queryKey: tenantsKeys.list(params),
      queryFn: ({ signal }) => listTenantsFn({ data: params, signal }),
    }),

  create: (qc: QueryClient) =>
    mutationOptions({
      mutationFn: (input: InsertTenantInput) => createTenantFn({ data: input }),
      onSuccess: () => qc.invalidateQueries({ queryKey: tenantsKeys.all }),
    }),

  update: (qc: QueryClient) =>
    mutationOptions({
      mutationFn: ({ id, patch }: { id: TenantId; patch: UpdateTenantInput }) =>
        patchTenant(id, patch),
      onSuccess: (_tenant, { id }) => {
        qc.invalidateQueries({ queryKey: tenantsKeys.byId(id) });
        qc.invalidateQueries({ queryKey: tenantsKeys.all });
      },
    }),

  softDelete: (qc: QueryClient) =>
    mutationOptions({
      mutationFn: (id: TenantId) => softDeleteTenantFn({ data: { id } }),
      onSuccess: (_tenant, id) => {
        qc.invalidateQueries({ queryKey: tenantsKeys.byId(id) });
        qc.invalidateQueries({ queryKey: tenantsKeys.all });
      },
    }),

  restore: (qc: QueryClient) =>
    mutationOptions({
      mutationFn: (id: TenantId) => restoreTenantFn({ data: { id } }),
      onSuccess: (_tenant, id) => {
        qc.invalidateQueries({ queryKey: tenantsKeys.byId(id) });
        qc.invalidateQueries({ queryKey: tenantsKeys.all });
      },
    }),

  permanentDelete: (qc: QueryClient) =>
    mutationOptions({
      mutationFn: (id: TenantId) => permanentDeleteTenantFn({ data: { id } }),
      onSuccess: () => qc.invalidateQueries({ queryKey: tenantsKeys.all }),
    }),
};
