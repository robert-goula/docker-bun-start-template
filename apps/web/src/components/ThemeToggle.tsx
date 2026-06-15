import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  setThemeFn,
  themeQueryOptions,
  type ResolvedTheme,
  type ThemeMode,
  type ThemeState,
} from "@/server/fns/theme";
import { DarkModeIcon, LightModeIcon, SystemModeIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import styles from "./ThemeToggle.module.css";
import { cx } from "class-variance-authority";

function applyThemeToDocument(state: ThemeState) {
  const root = document.documentElement;
  root.classList.remove("light", "dark");
  root.classList.add(state.resolved);
  if (state.mode === "system") {
    root.removeAttribute("data-theme");
  } else {
    root.setAttribute("data-theme", state.mode);
  }
  root.style.colorScheme = state.resolved;
}

function nextMode(mode: ThemeMode): ThemeMode {
  if (mode === "light") return "dark";
  if (mode === "dark") return "system";
  return "light";
}

function detectSystemResolved(): ResolvedTheme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export default function ThemeToggle() {
  const qc = useQueryClient();
  const { data } = useQuery(themeQueryOptions());

  const mutation = useMutation({
    mutationFn: (vars: { mode: ThemeMode; systemResolved?: ResolvedTheme }) =>
      setThemeFn({ data: vars }),
    onSuccess: (state) => {
      qc.setQueryData(themeQueryOptions().queryKey, state);
      applyThemeToDocument(state);
    },
  });

  const mode: ThemeMode = data?.mode ?? "system";

  useEffect(() => {
    if (mode !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      mutation.mutate({ mode: "system", systemResolved: detectSystemResolved() });
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [mode, mutation]);

  function onClick() {
    const next = nextMode(mode);
    mutation.mutate({
      mode: next,
      systemResolved: next === "system" ? detectSystemResolved() : undefined,
    });
  }

  const label =
    mode === "system"
      ? "Theme: system. Click to switch to light."
      : `Theme: ${mode}. Click to switch.`;

  return (
    <Button
      type="button"
      variant="default"
      size="xs"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cx(styles.ThemeToggle)}
      // className="rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)] px-3 py-1.5 text-sm font-semibold text-[var(--sea-ink)] shadow-[0_8px_22px_rgba(30,90,72,0.08)] transition hover:-translate-y-0.5"
    >
      {/*{mode === "system" ? "System" : mode === "dark" ? "Dark" : "Light"}*/}
      {mode === "system" ? (
        <SystemModeIcon />
      ) : mode === "dark" ? (
        <DarkModeIcon />
      ) : (
        <LightModeIcon />
      )}
    </Button>
  );
}
