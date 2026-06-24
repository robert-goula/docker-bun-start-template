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
 * locales the content actually exists in (the loader's translations, each with that
 * locale's own slug — slugs are per-locale); elsewhere it falls back to all enabled locales
 * under the current path. Uses a full navigation so the new locale is resolved server-side
 * (SSR-correct).
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
  // Each entry pairs a locale with the slug to link to in that locale. On a CMS page that's
  // the loader's per-locale translations; otherwise every enabled locale shares the path.
  const targets =
    cms?.meta?.translations && cms.meta.translations.length > 0
      ? cms.meta.translations
      : LOCALES.map((locale) => ({ locale, slug: cms?.ref?.slug ?? fallback.slug }));

  return (
    <nav aria-label={content.label.value}>
      {targets.map(({ locale, slug }) => (
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
