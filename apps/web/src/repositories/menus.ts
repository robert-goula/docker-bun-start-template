import { mutationOptions, queryOptions } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
import type { MenuId } from "@/db/schema/menus";
import type { Locale } from "@/db/schema/pages";
import {
  createMenuFn,
  deleteMenuFn,
  getMenuByIdFn,
  getMenuForRenderFn,
  listMenusFn,
  type UpdateMenuAttributes,
  updateMenuFn,
} from "@/server/fns/menus";

export const menusKeys = {
  all: ["menus"] as const,
  list: () => [...menusKeys.all, "list"] as const,
  byId: (id: MenuId) => [...menusKeys.all, "byId", id] as const,
  // The render projection is locale-baked, so the locale is part of the key (each
  // locale caches and refetches independently).
  forRender: (id: MenuId, locale: Locale) => [...menusKeys.all, "render", id, locale] as const,
};

export const menusRepo = {
  list: () =>
    queryOptions({
      queryKey: menusKeys.list(),
      queryFn: ({ signal }) => listMenusFn({ signal }),
    }),

  byId: (id: MenuId) =>
    queryOptions({
      queryKey: menusKeys.byId(id),
      queryFn: ({ signal }) => getMenuByIdFn({ data: { id }, signal }),
    }),

  // Public, render-only projection used to server-render placed menu widgets on public
  // pages. Prefetched in the page loader so it's present (dehydrated) during SSR. Menus
  // change rarely, so a long staleTime avoids a client refetch right after hydration.
  forRender: (id: MenuId, locale: Locale) =>
    queryOptions({
      queryKey: menusKeys.forRender(id, locale),
      queryFn: ({ signal }) => getMenuForRenderFn({ data: { id, locale }, signal }),
      staleTime: 5 * 60_000,
    }),

  create: (qc: QueryClient) =>
    mutationOptions({
      mutationFn: (input: { name: string; description?: string | null }) =>
        createMenuFn({ data: input }),
      onSuccess: () => qc.invalidateQueries({ queryKey: menusKeys.all }),
    }),

  update: (qc: QueryClient) =>
    mutationOptions({
      mutationFn: ({ id, patch }: { id: MenuId; patch: UpdateMenuAttributes }) =>
        updateMenuFn({ data: { id, patch } }),
      onSuccess: (updated, { id }) => {
        qc.setQueryData(menusKeys.byId(id), updated);
        qc.invalidateQueries({ queryKey: menusKeys.list() });
      },
    }),

  remove: (qc: QueryClient) =>
    mutationOptions({
      mutationFn: (id: MenuId) => deleteMenuFn({ data: { id } }),
      onSuccess: () => qc.invalidateQueries({ queryKey: menusKeys.all }),
    }),
};
