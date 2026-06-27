import { type Dictionary, t } from "intlayer";

// UI strings for the admin pages list. Read with useIntlayer("adminPages").
const adminPagesContent = {
  key: "adminPages",
  content: {
    title: t({ "en-us": "Pages", "es-us": "Páginas" }),
    slugLabel: t({ "en-us": "Slug", "es-us": "Slug" }),
    localeLabel: t({ "en-us": "Locale", "es-us": "Idioma" }),
    titleLabel: t({ "en-us": "Title (optional)", "es-us": "Título (opcional)" }),
    newPage: t({ "en-us": "+ New page", "es-us": "+ Nueva página" }),
    creating: t({ "en-us": "Creating…", "es-us": "Creando…" }),
    colTitle: t({ "en-us": "Title", "es-us": "Título" }),
    noPages: t({ "en-us": "No pages yet.", "es-us": "Aún no hay páginas." }),
    add: t({ "en-us": "+ Add", "es-us": "+ Añadir" }),
    view: t({ "en-us": "View", "es-us": "Ver" }),
  },
} satisfies Dictionary;

export default adminPagesContent;
