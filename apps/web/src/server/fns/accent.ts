import { createServerFn } from "@tanstack/react-start";
import { queryOptions } from "@tanstack/react-query";
import * as z from "zod";

export type Accent = "indigo" | "red" | "gold" | "moss" | "slate";

export interface AccentOption {
  value: Accent;
  /** Human-readable label shown in the picker. */
  label: string;
  /** Traditional Japanese colour name for flavour. */
  name: string;
}

export const ACCENTS: readonly AccentOption[] = [
  { value: "indigo", label: "Indigo", name: "Ai-iro" },
  { value: "red", label: "Terracotta", name: "Beni-iro" },
  { value: "gold", label: "Gold", name: "Yamabuki" },
  { value: "moss", label: "Moss", name: "Tokusa" },
  { value: "slate", label: "Slate", name: "Nezumi" },
];

export const ACCENT_VALUES: readonly Accent[] = ACCENTS.map((a) => a.value);
export const DEFAULT_ACCENT: Accent = "moss";

const ACCENT_COOKIE = "accent";
const ACCENT_COOKIE_OPTS = {
  secure: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 365,
};

function isAccent(value: unknown): value is Accent {
  return ACCENT_VALUES.includes(value as Accent);
}

export const getAccentFn = createServerFn({ method: "GET" }).handler(async (): Promise<Accent> => {
  const { getCookie } = await import("@tanstack/react-start/server");
  const value = getCookie(ACCENT_COOKIE);
  return isAccent(value) ? value : DEFAULT_ACCENT;
});

const SetAccentInput = z.object({ accent: z.enum(["indigo", "red", "gold", "moss", "slate"]) });

export const setAccentFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => SetAccentInput.parse(input))
  .handler(async ({ data }): Promise<Accent> => {
    const { setCookie } = await import("@tanstack/react-start/server");
    setCookie(ACCENT_COOKIE, data.accent, ACCENT_COOKIE_OPTS);
    return data.accent;
  });

export const accentQueryOptions = () =>
  queryOptions({
    queryKey: ["accent"] as const,
    queryFn: ({ signal }) => getAccentFn({ signal }),
    staleTime: Infinity,
  });
