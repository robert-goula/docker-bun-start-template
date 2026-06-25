import { type Dictionary, t } from "intlayer";

// UI strings for the debug widget. Co-located with Debug.tsx and excluded from routing
// by vite.config's routeFileIgnorePattern. Read with useIntlayer("debug").
const debugContent = {
  key: "debug",
  content: {
    locale: t({ "en-us": "Locale", "es-us": "Idioma" }),
    routeId: t({ "en-us": "Route ID", "es-us": "ID de ruta" }),
    routeWithParams: t({
      "en-us": "Route (with params)",
      "es-us": "Ruta (con parámetros)",
    }),
    params: t({ "en-us": "Params", "es-us": "Parámetros" }),
    resolvedSlug: t({ "en-us": "Resolved slug", "es-us": "Slug resuelto" }),
    redirecting: t({ "en-us": "(redirecting…)", "es-us": "(redirigiendo…)" }),
  },
} satisfies Dictionary;

export default debugContent;
