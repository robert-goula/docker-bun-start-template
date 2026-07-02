import { type Dictionary, t } from "intlayer";

// UI strings for the admin config section (list + detail share this key).
// Read with useIntlayer("adminConfig").
const adminConfigContent = {
  key: "adminConfig",
  content: {
    title: t({ "en-us": "Config", "es-us": "Configuración" }),
    colKey: t({ "en-us": "Key", "es-us": "Clave" }),
    colValue: t({ "en-us": "Value", "es-us": "Valor" }),
    colDescription: t({ "en-us": "Description", "es-us": "Descripción" }),
    noConfig: t({
      "en-us": "No config entries yet.",
      "es-us": "Aún no hay entradas de configuración.",
    }),
    newKey: t({ "en-us": "New key", "es-us": "Nueva clave" }),
    descriptionLabel: t({ "en-us": "Description", "es-us": "Descripción" }),
    optional: t({ "en-us": "Optional", "es-us": "Opcional" }),
    valueJson: t({ "en-us": "Value (JSON)", "es-us": "Valor (JSON)" }),
    createConfig: t({ "en-us": "Create config", "es-us": "Crear configuración" }),
    cancel: t({ "en-us": "Cancel", "es-us": "Cancelar" }),
    saving: t({ "en-us": "Saving…", "es-us": "Guardando…" }),
    invalidKey: t({ "en-us": "Invalid key", "es-us": "Clave no válida" }),
    invalidKeyHint: t({
      "en-us": "Use dotted notation, e.g. plugins.enabled",
      "es-us": "Usa notación con puntos, p. ej. plugins.enabled",
    }),
    notValidJson: t({ "en-us": "Value is not valid JSON", "es-us": "El valor no es JSON válido" }),
    savedToast: t({ "en-us": "Config saved", "es-us": "Configuración guardada" }),
    saveError: t({
      "en-us": "Couldn’t save config",
      "es-us": "No se pudo guardar la configuración",
    }),
    tryAgain: t({ "en-us": "Please try again.", "es-us": "Inténtalo de nuevo." }),
    // Detail page
    backToConfig: t({ "en-us": "← Config", "es-us": "← Configuración" }),
    editConfig: t({ "en-us": "Edit config", "es-us": "Editar configuración" }),
    keyLabel: t({ "en-us": "Key", "es-us": "Clave" }),
    save: t({ "en-us": "Save", "es-us": "Guardar" }),
    delete: t({ "en-us": "Delete", "es-us": "Eliminar" }),
    deletePrefix: t({ "en-us": 'Delete config "', "es-us": '¿Eliminar la configuración "' }),
    deleteSuffix: t({
      "en-us": '"? This cannot be undone.',
      "es-us": '"? Esto no se puede deshacer.',
    }),
    deletedToast: t({ "en-us": "Config deleted", "es-us": "Configuración eliminada" }),
    deleteError: t({
      "en-us": "Couldn’t delete config",
      "es-us": "No se pudo eliminar la configuración",
    }),
  },
} satisfies Dictionary;

export default adminConfigContent;
