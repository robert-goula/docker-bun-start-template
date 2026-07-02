import { type Dictionary, t } from "intlayer";

// UI strings for the admin tenants list. Read with useIntlayer("adminTenants").
const adminTenantsContent = {
  key: "adminTenants",
  content: {
    title: t({ "en-us": "Tenants", "es-us": "Inquilinos" }),
    searchPlaceholder: t({ "en-us": "Search tenants…", "es-us": "Buscar inquilinos…" }),
    statusActive: t({ "en-us": "Active", "es-us": "Activos" }),
    statusDeleted: t({ "en-us": "Deleted", "es-us": "Eliminados" }),
    colName: t({ "en-us": "Name", "es-us": "Nombre" }),
    colCreated: t({ "en-us": "Created", "es-us": "Creado" }),
    colDeleted: t({ "en-us": "Deleted", "es-us": "Eliminado" }),
    newNamePlaceholder: t({ "en-us": "New tenant name", "es-us": "Nombre del nuevo inquilino" }),
    add: t({ "en-us": "Add tenant", "es-us": "Añadir inquilino" }),
    addTitle: t({ "en-us": "New tenant", "es-us": "Nuevo inquilino" }),
    nameLabel: t({ "en-us": "Name", "es-us": "Nombre" }),
    cancel: t({ "en-us": "Cancel", "es-us": "Cancelar" }),
    submit: t({ "en-us": "Create", "es-us": "Crear" }),
    adding: t({ "en-us": "Adding…", "es-us": "Añadiendo…" }),
    created: t({ "en-us": "Tenant created", "es-us": "Inquilino creado" }),
    createFailed: t({ "en-us": "Couldn’t create tenant", "es-us": "No se pudo crear el inquilino" }),
    noTenants: t({ "en-us": "No tenants.", "es-us": "No hay inquilinos." }),
    noResults: t({ "en-us": "No results", "es-us": "Sin resultados" }),
    of: t({ "en-us": "of", "es-us": "de" }),
    tenants: t({ "en-us": "tenants", "es-us": "inquilinos" }),
    page: t({ "en-us": "Page", "es-us": "Página" }),
    prev: t({ "en-us": "Previous", "es-us": "Anterior" }),
    next: t({ "en-us": "Next", "es-us": "Siguiente" }),
    perPage: t({ "en-us": "Per page", "es-us": "Por página" }),
  },
} satisfies Dictionary;

export default adminTenantsContent;
