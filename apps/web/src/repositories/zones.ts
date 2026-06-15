import { queryOptions } from "@tanstack/react-query";
import { listZonesFn } from "@/server/fns/zones";

export const zonesKeys = {
  all: ["zones"] as const,
  list: () => [...zonesKeys.all, "list"] as const,
};

export const zonesRepo = {
  list: () =>
    queryOptions({
      queryKey: zonesKeys.list(),
      queryFn: ({ signal }) => listZonesFn({ signal }),
    }),
};
