import { createServerFn } from "@tanstack/react-start";
import { queryOptions } from "@tanstack/react-query";
import * as z from "zod";

export type Size = "xs" | "sm" | "md" | "lg" | "xl";

export const SIZES: readonly Size[] = ["xs", "sm", "md", "lg", "xl"];
export const DEFAULT_SIZE: Size = "md";

const SIZE_COOKIE = "size";
const SIZE_COOKIE_OPTS = {
  secure: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 365,
};

function isSize(value: unknown): value is Size {
  return SIZES.includes(value as Size);
}

export const getSizeFn = createServerFn({ method: "GET" }).handler(async (): Promise<Size> => {
  const { getCookie } = await import("@tanstack/react-start/server");
  const value = getCookie(SIZE_COOKIE);
  return isSize(value) ? value : DEFAULT_SIZE;
});

const AdjustSizeInput = z.object({ direction: z.enum(["+", "-"]) });

export const adjustSizeFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => AdjustSizeInput.parse(input))
  .handler(async ({ data }): Promise<Size> => {
    const { getCookie, setCookie } = await import("@tanstack/react-start/server");
    const current = getCookie(SIZE_COOKIE);
    const currentIndex = SIZES.indexOf(isSize(current) ? current : DEFAULT_SIZE);
    const nextIndex =
      data.direction === "+"
        ? Math.min(currentIndex + 1, SIZES.length - 1)
        : Math.max(currentIndex - 1, 0);
    const nextSize = SIZES[nextIndex];
    setCookie(SIZE_COOKIE, nextSize, SIZE_COOKIE_OPTS);
    return nextSize;
  });

export const sizeQueryOptions = () =>
  queryOptions({
    queryKey: ["size"] as const,
    queryFn: ({ signal }) => getSizeFn({ signal }),
    staleTime: Infinity,
  });
