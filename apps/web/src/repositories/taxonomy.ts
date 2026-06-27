import { mutationOptions, queryOptions } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
import type * as z from "zod";
import { type Locale } from "@/db/schema/pages";
import {
  selectTaxonomySchema,
  type CreateTaxonomyInput,
  type ListTaxonomiesPagedMeta,
  type ListTaxonomiesParams,
  type TaxonomyId,
  type UpdateTaxonomyInput,
} from "@/db/schema/taxonomy";
import {
  createTaxonomyFn,
  deleteTaxonomyFn,
  getTaxonomyByIdFn,
  getTaxonomyOptionsFn,
  listTaxonomiesFn,
  listTaxonomyChildrenFn,
  updateTaxonomyFn,
} from "@/server/fns/taxonomy";

export type SafeTaxonomy = z.infer<typeof selectTaxonomySchema>;
export type { ListTaxonomiesPagedMeta };

export const taxonomyKeys = {
  all: ["taxonomy"] as const,
  list: (params?: ListTaxonomiesParams) => [...taxonomyKeys.all, "list", params ?? {}] as const,
  byId: (id: TaxonomyId) => [...taxonomyKeys.all, "byId", id] as const,
  byParent: (parentId: TaxonomyId | null) => [...taxonomyKeys.all, "byParent", parentId] as const,
  options: (parentId: TaxonomyId | null, locale: Locale) =>
    [...taxonomyKeys.all, "options", parentId, locale] as const,
};

export const taxonomyRepo = {
  byId: (id: TaxonomyId) =>
    queryOptions({
      queryKey: taxonomyKeys.byId(id),
      queryFn: ({ signal }) => getTaxonomyByIdFn({ data: { id }, signal }),
    }),

  list: (params: ListTaxonomiesParams) =>
    queryOptions({
      queryKey: taxonomyKeys.list(params),
      queryFn: ({ signal }) => listTaxonomiesFn({ data: params, signal }),
    }),

  // Admin builder: full child rows of a parent (parentId null → roots).
  byParent: (parentId: TaxonomyId | null) =>
    queryOptions({
      queryKey: taxonomyKeys.byParent(parentId),
      queryFn: ({ signal }) => listTaxonomyChildrenFn({ data: { parentId }, signal }),
    }),

  // Public: locale-resolved options a field control renders as select/radio/checkbox.
  options: (parentId: TaxonomyId | null, locale: Locale) =>
    queryOptions({
      queryKey: taxonomyKeys.options(parentId, locale),
      queryFn: ({ signal }) => getTaxonomyOptionsFn({ data: { parentId, locale }, signal }),
    }),

  create: (qc: QueryClient) =>
    mutationOptions({
      mutationFn: (input: CreateTaxonomyInput) => createTaxonomyFn({ data: input }),
      onSuccess: () => qc.invalidateQueries({ queryKey: taxonomyKeys.all }),
    }),

  update: (qc: QueryClient) =>
    mutationOptions({
      mutationFn: ({ id, patch }: { id: TaxonomyId; patch: UpdateTaxonomyInput }) =>
        updateTaxonomyFn({ data: { id, patch } }),
      onSuccess: (_taxonomy, { id }) => {
        qc.invalidateQueries({ queryKey: taxonomyKeys.byId(id) });
        qc.invalidateQueries({ queryKey: taxonomyKeys.all });
      },
    }),

  remove: (qc: QueryClient) =>
    mutationOptions({
      mutationFn: (id: TaxonomyId) => deleteTaxonomyFn({ data: { id } }),
      onSuccess: () => qc.invalidateQueries({ queryKey: taxonomyKeys.all }),
    }),
};
