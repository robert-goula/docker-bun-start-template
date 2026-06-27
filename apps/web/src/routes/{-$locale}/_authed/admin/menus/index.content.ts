import { type Dictionary, t } from "intlayer";

// UI strings for the admin menus section (list + detail share this key).
// Read with useIntlayer("adminMenus").
const adminMenusContent = {
  key: "adminMenus",
  content: {
    title: t({ "en-us": "Menus", "es-us": "Menús" }),
    colName: t({ "en-us": "Name", "es-us": "Nombre" }),
    colSlug: t({ "en-us": "Slug", "es-us": "Slug" }),
    colItems: t({ "en-us": "Items", "es-us": "Elementos" }),
    colDescription: t({ "en-us": "Description", "es-us": "Descripción" }),
    noMenus: t({ "en-us": "No menus yet.", "es-us": "Aún no hay menús." }),
    newMenuName: t({ "en-us": "New menu name", "es-us": "Nombre del nuevo menú" }),
    descriptionLabel: t({ "en-us": "Description", "es-us": "Descripción" }),
    optional: t({ "en-us": "Optional", "es-us": "Opcional" }),
    createMenu: t({ "en-us": "Create menu", "es-us": "Crear menú" }),
    creating: t({ "en-us": "Creating…", "es-us": "Creando…" }),
    createdToast: t({ "en-us": "Menu created", "es-us": "Menú creado" }),
    createError: t({ "en-us": "Couldn’t create menu", "es-us": "No se pudo crear el menú" }),
    tryAgain: t({ "en-us": "Please try again.", "es-us": "Inténtalo de nuevo." }),
    // Detail page
    backToMenus: t({ "en-us": "← Menus", "es-us": "← Menús" }),
    editMenu: t({ "en-us": "Edit menu", "es-us": "Editar menú" }),
    nameLabel: t({ "en-us": "Name", "es-us": "Nombre" }),
    slugLabel: t({ "en-us": "Slug", "es-us": "Slug" }),
    orientationLabel: t({ "en-us": "Orientation", "es-us": "Orientación" }),
    vertical: t({ "en-us": "Vertical", "es-us": "Vertical" }),
    horizontal: t({ "en-us": "Horizontal", "es-us": "Horizontal" }),
    submenuLabel: t({ "en-us": "Submenu display", "es-us": "Visualización de submenú" }),
    alwaysExpanded: t({ "en-us": "Always expanded", "es-us": "Siempre expandido" }),
    dropdown: t({ "en-us": "Dropdown", "es-us": "Desplegable" }),
    itemsHeading: t({ "en-us": "Items", "es-us": "Elementos" }),
    saveError: t({
      "en-us": "Couldn’t save changes",
      "es-us": "No se pudieron guardar los cambios",
    }),
    saveMenuError: t({ "en-us": "Couldn’t save menu", "es-us": "No se pudo guardar el menú" }),
    itemsInvalid: t({
      "en-us": "Some items are invalid.",
      "es-us": "Algunos elementos no son válidos.",
    }),
  },
} satisfies Dictionary;

export default adminMenusContent;
