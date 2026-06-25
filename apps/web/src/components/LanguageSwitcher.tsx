import { useLocation, useRouterState } from "@tanstack/react-router";
import { useIntlayer } from "react-intlayer";
import { Menu } from "@base-ui/react";
import { ChevronDownIcon } from "lucide-react";
import { buildHref, LOCALES, type Locale, resolveLocale } from "@/lib/locale";
import type { PageRef } from "@/lib/loadPage";
import type { PageMeta } from "@/server/services/PageRepo";
import styles from "./LanguageSwitcher.module.css";

// Endonyms — a locale's name in its own language. Locale-invariant, so not translated.
const LOCALE_NAMES: Record<Locale, string> = {
  "en-us": "English",
  "es-us": "Español",
};

type CmsLoaderData = { meta?: PageMeta | null; ref?: PageRef };

/**
 * Switches locale while preserving the current page. Shows the current language with a
 * dropdown indicator; the menu offers the other available languages. On a CMS page it
 * offers only the locales the content actually exists in (the loader's translations, each
 * with that locale's own slug — slugs are per-locale); elsewhere it falls back to all
 * enabled locales under the current path. Uses a full navigation so the new locale is
 * resolved server-side (SSR-correct).
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

  // Only the languages other than the current one are selectable in the menu.
  const others = targets.filter(({ locale }) => locale !== current);

  return (
    <Menu.Root>
      <Menu.Trigger
        className={styles.trigger}
        aria-label={content.label.value}
        disabled={others.length === 0}
      >
        <span lang={current}>{LOCALE_NAMES[current]}</span>
        <ChevronDownIcon className={styles.icon} aria-hidden />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner className={styles.positioner} sideOffset={6} align="end">
          <Menu.Popup className={styles.popup}>
            {others.map(({ locale, slug }) => (
              <Menu.LinkItem
                key={locale}
                className={styles.item}
                href={buildHref(locale, slug)}
                hrefLang={locale}
                lang={locale}
              >
                {LOCALE_NAMES[locale]}
              </Menu.LinkItem>
            ))}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
