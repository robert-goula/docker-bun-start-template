import { createServerFn } from "@tanstack/react-start";
import { queryOptions } from "@tanstack/react-query";
import * as z from "zod";

export type ThemeMode = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export interface ThemeState {
  mode: ThemeMode;
  resolved: ResolvedTheme;
}

export const THEME_MODE_COOKIE = "theme-mode";
export const THEME_RESOLVED_COOKIE = "theme";

const THEME_COOKIE_OPTS = {
  secure: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 365,
};

function isMode(value: unknown): value is ThemeMode {
  return value === "light" || value === "dark" || value === "system";
}

function isResolved(value: unknown): value is ResolvedTheme {
  return value === "light" || value === "dark";
}

async function readThemeFromRequest(): Promise<ThemeState> {
  const { getCookie, getRequestHeader, setResponseHeader } = await import(
    "@tanstack/react-start/server"
  );

  setResponseHeader("Accept-CH", "Sec-CH-Prefers-Color-Scheme");
  setResponseHeader("Vary", "Sec-CH-Prefers-Color-Scheme");

  const rawMode = getCookie(THEME_MODE_COOKIE);
  const mode: ThemeMode = isMode(rawMode) ? rawMode : "system";

  let resolved: ResolvedTheme;
  if (mode === "light" || mode === "dark") {
    resolved = mode;
  } else {
    const hint = getRequestHeader("sec-ch-prefers-color-scheme" as never);
    if (hint === "dark") {
      resolved = "dark";
    } else if (hint === "light") {
      resolved = "light";
    } else {
      const cached = getCookie(THEME_RESOLVED_COOKIE);
      resolved = isResolved(cached) ? cached : "light";
    }
  }

  return { mode, resolved };
}

const SetThemeInput = z.object({
  mode: z.enum(["light", "dark", "system"]),
  systemResolved: z.enum(["light", "dark"]).optional(),
});

export const getThemeFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<ThemeState> => readThemeFromRequest(),
);

export const setThemeFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => SetThemeInput.parse(input))
  .handler(async ({ data }): Promise<ThemeState> => {
    const { getCookie, setCookie } = await import("@tanstack/react-start/server");

    setCookie(THEME_MODE_COOKIE, data.mode, THEME_COOKIE_OPTS);

    let resolved: ResolvedTheme;
    if (data.mode === "light" || data.mode === "dark") {
      resolved = data.mode;
    } else if (data.systemResolved) {
      resolved = data.systemResolved;
    } else {
      const cached = getCookie(THEME_RESOLVED_COOKIE);
      resolved = isResolved(cached) ? cached : "light";
    }

    setCookie(THEME_RESOLVED_COOKIE, resolved, THEME_COOKIE_OPTS);

    return { mode: data.mode, resolved };
  });

export const themeQueryOptions = () =>
  queryOptions({
    queryKey: ["theme"] as const,
    queryFn: ({ signal }) => getThemeFn({ signal }),
    staleTime: Infinity,
  });
