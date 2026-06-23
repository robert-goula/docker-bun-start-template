import { useLocation, useRouterState } from "@tanstack/react-router";
import { useIntlayer } from "react-intlayer";
import { cx } from "class-variance-authority";
import { buildHref, LOCALES, type Locale, resolveLocale } from "@/lib/locale";
import type { PageRef } from "@/lib/loadPage";
import type { PageMeta } from "@/server/services/PageRepo";

// Endonyms — a locale's name in its own language. Locale-invariant, so not translated.
const LOCALE_NAMES: Record<Locale, string> = {
  "en-us": "English",
  "es-us": "Español",
};

type CmsLoaderData = { meta?: PageMeta | null; ref?: PageRef };

/**
 * Switches locale while preserving the current page. On a CMS page it offers only the
 * locales the content actually exists in (the loader's availableLocales, keyed by the
 * shared slug); elsewhere it falls back to all enabled locales under the current path.
 * Uses a full navigation so the new locale is resolved server-side (SSR-correct).
 */
export default function LanguageSwitcher() {
  const content = useIntlayer("languageSwitcher");
  const pathname = useLocation({ select: (l) => l.pathname });

  // Pull the matched leaf route's loader data, if it's a CMS page (has meta/ref).
  const cms = useRouterState({
    select: (s) => s.matches[s.matches.length - 1]?.loaderData as CmsLoaderData | undefined,
  });

  const resolved = resolveLocale(pathname);
  const fallback =
    resolved.redirect !== undefined
      ? { locale: "en-us" as Locale, slug: "/" }
      : { locale: resolved.locale, slug: resolved.path };

  const current = cms?.ref?.locale ?? fallback.locale;
  const slug = cms?.ref?.slug ?? fallback.slug;
  const locales =
    cms?.meta?.availableLocales && cms.meta.availableLocales.length > 0
      ? cms.meta.availableLocales
      : LOCALES;

  return (
    <nav aria-label={content.label.value}>
      {locales.map((locale) => (
        <a
          key={locale}
          href={buildHref(locale, slug)}
          hrefLang={locale}
          aria-current={locale === current ? "true" : undefined}
          className={cx("nav-link", locale === current && "is-active")}
        >
          {LOCALE_NAMES[locale]}
        </a>
      ))}
    </nav>
  );
}
