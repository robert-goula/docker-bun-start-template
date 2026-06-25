import { queryOptions } from "@tanstack/react-query";
import { listPageGroupsFn, listPagesFn } from "@/server/fns/pages";

export const pagesKeys = {
  all: ["pages"] as const,
  list: () => [...pagesKeys.all, "list"] as const,
  groups: () => [...pagesKeys.all, "groups"] as const,
};

export const pagesRepo = {
  list: () =>
    queryOptions({
      queryKey: pagesKeys.list(),
      queryFn: ({ signal }) => listPagesFn({ signal }),
    }),

  // Canonical (default-locale) pages for pickers — one row per translation group.
  groups: () =>
    queryOptions({
      queryKey: pagesKeys.groups(),
      queryFn: ({ signal }) => listPageGroupsFn({ signal }),
    }),
};
