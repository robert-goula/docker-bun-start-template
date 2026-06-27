import { type Dictionary, t } from "intlayer";

// UI strings for the admin taxonomy section (list + detail share this key).
// Read with useIntlayer("adminTaxonomy"). The `*Prefix`/`*Suffix` pairs wrap a runtime
// value (the taxonomy's canonical value) in confirm/toast messages.
const adminTaxonomyContent = {
  key: "adminTaxonomy",
  content: {
    title: t({ "en-us": "Taxonomy", "es-us": "Taxonomía" }),
    allTaxonomies: t({ "en-us": "All taxonomies", "es-us": "Todas las taxonomías" }),
    upOneLevel: t({ "en-us": "← Up one level", "es-us": "← Subir un nivel" }),
    colLabel: t({ "en-us": "Label", "es-us": "Etiqueta" }),
    colValue: t({ "en-us": "Value", "es-us": "Valor" }),
    colLocales: t({ "en-us": "Locales", "es-us": "Idiomas" }),
    colSort: t({ "en-us": "Sort", "es-us": "Orden" }),
    colCreated: t({ "en-us": "Created", "es-us": "Creado" }),
    edit: t({ "en-us": "Edit", "es-us": "Editar" }),
    delete: t({ "en-us": "Delete", "es-us": "Eliminar" }),
    noChild: t({ "en-us": "No child taxonomies yet.", "es-us": "Aún no hay taxonomías hijas." }),
    noTaxonomies: t({ "en-us": "No taxonomies yet.", "es-us": "Aún no hay taxonomías." }),
    deletePrefix: t({ "en-us": 'Delete "', "es-us": '¿Eliminar "' }),
    deleteSuffix: t({
      "en-us": '" and all of its descendant taxonomies? This cannot be undone.',
      "es-us": '" y todas sus taxonomías descendientes? Esto no se puede deshacer.',
    }),
    deleted: t({ "en-us": "Deleted", "es-us": "Eliminado" }),
    deleteError: t({
      "en-us": "Couldn’t delete taxonomy",
      "es-us": "No se pudo eliminar la taxonomía",
    }),
    tryAgain: t({ "en-us": "Please try again.", "es-us": "Inténtalo de nuevo." }),
    added: t({ "en-us": "Added", "es-us": "Añadido" }),
    addError: t({ "en-us": "Couldn’t add taxonomy", "es-us": "No se pudo añadir la taxonomía" }),
    newTermUnder: t({ "en-us": "New term under", "es-us": "Nuevo término bajo" }),
    newRootTaxonomy: t({ "en-us": "New root taxonomy", "es-us": "Nueva taxonomía raíz" }),
    valueCanonical: t({ "en-us": "Value (canonical)", "es-us": "Valor (canónico)" }),
    labelWord: t({ "en-us": "Label", "es-us": "Etiqueta" }),
    creating: t({ "en-us": "Creating…", "es-us": "Creando…" }),
    create: t({ "en-us": "Create", "es-us": "Crear" }),
    // Detail page
    backToList: t({ "en-us": "← Back to list", "es-us": "← Volver a la lista" }),
    editTaxonomy: t({ "en-us": "Edit taxonomy", "es-us": "Editar taxonomía" }),
    sortLabel: t({ "en-us": "Sort", "es-us": "Orden" }),
    defaultSuffix: t({ "en-us": " — default", "es-us": " — predeterminado" }),
    translationPlaceholder: t({ "en-us": "translation", "es-us": "traducción" }),
    saved: t({ "en-us": "Saved", "es-us": "Guardado" }),
    saveError: t({ "en-us": "Couldn’t save taxonomy", "es-us": "No se pudo guardar la taxonomía" }),
    saving: t({ "en-us": "Saving…", "es-us": "Guardando…" }),
    saveChanges: t({ "en-us": "Save changes", "es-us": "Guardar cambios" }),
  },
} satisfies Dictionary;

export default adminTaxonomyContent;
