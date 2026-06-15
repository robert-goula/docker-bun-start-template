import { queryOptions } from "@tanstack/react-query";
import { listPagesFn } from "@/server/fns/pages";

export const pagesKeys = {
  all: ["pages"] as const,
  list: () => [...pagesKeys.all, "list"] as const,
};

export const pagesRepo = {
  list: () =>
    queryOptions({
      queryKey: pagesKeys.list(),
      queryFn: ({ signal }) => listPagesFn({ signal }),
    }),
};
