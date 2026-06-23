import type { IntlayerConfig } from "intlayer";

type IntlLocales = NonNullable<IntlayerConfig["internationalization"]>["locales"];

// intlayer owns code-level UI strings only; page content/metadata live in the CMS,
// and locale + URL shape are owned by the router (see src/lib/locale.ts). Locales are
// our lowercase app codes (custom strings, matching the DB and URLs) — intlayer detection
// is bypassed because the request-scoped locale is passed to IntlayerProvider explicitly.
//
// intlayer's config *input* type narrows locales to its built-in `Locales` enum (which
// uses "en-US" casing), but the runtime schema accepts any string and the generated
// dictionary/provider types pick up our lowercase codes. So we keep lowercase to match the
// DB/URLs and cast here — the only place the two casings meet.
const config: IntlayerConfig = {
  internationalization: {
    locales: ["en-us", "es-us"] as unknown as IntlLocales,
    defaultLocale: "en-us" as unknown as NonNullable<IntlLocales>[number],
  },
  // Default locale is unprefixed ("/about"); others are prefixed ("/es-us/about").
  // Mirrors src/lib/locale.ts buildHref so the two never drift.
  routing: {
    mode: "prefix-no-default",
  },
};

export default config;
