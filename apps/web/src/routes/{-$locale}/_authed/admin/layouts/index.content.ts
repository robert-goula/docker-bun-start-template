import { type Dictionary, t } from "intlayer";

// UI strings for the admin layouts section (list + detail share this key).
// Read with useIntlayer("adminLayouts").
const adminLayoutsContent = {
  key: "adminLayouts",
  content: {
    title: t({ "en-us": "Layouts", "es-us": "Diseños" }),
    colName: t({ "en-us": "Name", "es-us": "Nombre" }),
    colDescription: t({ "en-us": "Description", "es-us": "Descripción" }),
    colCreated: t({ "en-us": "Created", "es-us": "Creado" }),
    noLayouts: t({ "en-us": "No layouts yet.", "es-us": "Aún no hay diseños." }),
    newLayoutName: t({ "en-us": "New layout name", "es-us": "Nombre del nuevo diseño" }),
    descriptionLabel: t({ "en-us": "Description", "es-us": "Descripción" }),
    optional: t({ "en-us": "Optional", "es-us": "Opcional" }),
    createLayout: t({ "en-us": "Create layout", "es-us": "Crear diseño" }),
    creating: t({ "en-us": "Creating…", "es-us": "Creando…" }),
    createdToast: t({ "en-us": "Layout created", "es-us": "Diseño creado" }),
    createError: t({ "en-us": "Couldn’t create layout", "es-us": "No se pudo crear el diseño" }),
    tryAgain: t({ "en-us": "Please try again.", "es-us": "Inténtalo de nuevo." }),
    // Detail page
    back: t({ "en-us": "← Back", "es-us": "← Atrás" }),
    backToLayouts: t({ "en-us": "Back to layouts", "es-us": "Volver a diseños" }),
    nameLabel: t({ "en-us": "Name", "es-us": "Nombre" }),
    zonesHeading: t({ "en-us": "Zones", "es-us": "Zonas" }),
    zonesHelp: t({
      "en-us":
        "Drag a zone to reorder it; open a zone’s settings to change its size, title and default state. The blocks below preview the layout. Changes save automatically.",
      "es-us":
        "Arrastra una zona para reordenarla; abre los ajustes de una zona para cambiar su tamaño, título y estado predeterminado. Los bloques de abajo previsualizan el diseño. Los cambios se guardan automáticamente.",
    }),
    defaultWidgetsHeading: t({
      "en-us": "Default widgets",
      "es-us": "Widgets predeterminados",
    }),
    defaultWidgetsHelp: t({
      "en-us":
        "Widgets placed here appear on every page using this layout, without being added per page. Pick a locale to give that language its own defaults (e.g. a localized nav menu), or “All locales” for defaults shared across languages (e.g. a debug panel). Each widget’s settings let you pin it to the top or bottom of its zone.",
      "es-us":
        "Los widgets colocados aquí aparecen en cada página que usa este diseño, sin añadirlos por página. Elige un idioma para darle a esa lengua sus propios predeterminados (p. ej. un menú de navegación localizado), o “Todos los idiomas” para predeterminados compartidos entre idiomas (p. ej. un panel de depuración). Los ajustes de cada widget te permiten fijarlo arriba o abajo en su zona.",
    }),
    editingDefaultsFor: t({
      "en-us": "Editing defaults for",
      "es-us": "Editando predeterminados para",
    }),
    allLocales: t({ "en-us": "All locales", "es-us": "Todos los idiomas" }),
    scopeHintAll: t({
      "en-us": "Shown on every locale unless overridden per-locale",
      "es-us": "Mostrado en todos los idiomas salvo que se anule por idioma",
    }),
    shownOnlyOn: t({ "en-us": "Shown only on", "es-us": "Mostrado solo en" }),
    localePages: t({ "en-us": "pages", "es-us": "páginas" }),
    loading: t({ "en-us": "Loading…", "es-us": "Cargando…" }),
  },
} satisfies Dictionary;

export default adminLayoutsContent;
