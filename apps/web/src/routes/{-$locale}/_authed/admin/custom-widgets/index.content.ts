import { type Dictionary, t } from "intlayer";

// UI strings for the admin custom-widgets section (list + detail share this key).
// Read with useIntlayer("adminCustomWidgets").
const adminCustomWidgetsContent = {
  key: "adminCustomWidgets",
  content: {
    title: t({ "en-us": "Custom widgets", "es-us": "Widgets personalizados" }),
    colName: t({ "en-us": "Name", "es-us": "Nombre" }),
    colFields: t({ "en-us": "Fields", "es-us": "Campos" }),
    colDescription: t({ "en-us": "Description", "es-us": "Descripción" }),
    noWidgets: t({
      "en-us": "No custom widgets yet.",
      "es-us": "Aún no hay widgets personalizados.",
    }),
    newWidgetName: t({
      "en-us": "New custom widget name",
      "es-us": "Nombre del nuevo widget personalizado",
    }),
    descriptionLabel: t({ "en-us": "Description", "es-us": "Descripción" }),
    optional: t({ "en-us": "Optional", "es-us": "Opcional" }),
    createWidget: t({ "en-us": "Create custom widget", "es-us": "Crear widget personalizado" }),
    creating: t({ "en-us": "Creating…", "es-us": "Creando…" }),
    createdToast: t({ "en-us": "Custom widget created", "es-us": "Widget personalizado creado" }),
    createError: t({
      "en-us": "Couldn’t create custom widget",
      "es-us": "No se pudo crear el widget personalizado",
    }),
    tryAgain: t({ "en-us": "Please try again.", "es-us": "Inténtalo de nuevo." }),
    // Detail page
    back: t({ "en-us": "← Back", "es-us": "← Atrás" }),
    backToList: t({
      "en-us": "Back to custom widgets",
      "es-us": "Volver a widgets personalizados",
    }),
    nameLabel: t({ "en-us": "Name", "es-us": "Nombre" }),
    templateLabel: t({ "en-us": "Template", "es-us": "Plantilla" }),
    templatePlaceholder: t({
      "en-us": "Optional display component key (e.g. headline)",
      "es-us": "Clave de componente de visualización opcional (p. ej. headline)",
    }),
    defaultTagLabel: t({ "en-us": "Default tag", "es-us": "Etiqueta predeterminada" }),
    defaultTagOption: t({ "en-us": "Default (section)", "es-us": "Predeterminado (section)" }),
    fieldsHeading: t({ "en-us": "Fields", "es-us": "Campos" }),
    fieldsHelp: t({
      "en-us":
        "Drag a field to reorder it; the order here is how the fields are shown when editing and displaying an instance. Edits stay local until you click Save changes.",
      "es-us":
        "Arrastra un campo para reordenarlo; este orden es cómo se muestran los campos al editar y mostrar una instancia. Los cambios permanecen locales hasta que pulses Guardar cambios.",
    }),
    saveError: t({
      "en-us": "Couldn’t save changes",
      "es-us": "No se pudieron guardar los cambios",
    }),
    fieldsInvalid: t({
      "en-us": "Some fields are invalid.",
      "es-us": "Algunos campos no son válidos.",
    }),
    saveRetry: t({
      "en-us": "Couldn’t save changes. Please try again.",
      "es-us": "No se pudieron guardar los cambios. Inténtalo de nuevo.",
    }),
  },
} satisfies Dictionary;

export default adminCustomWidgetsContent;
