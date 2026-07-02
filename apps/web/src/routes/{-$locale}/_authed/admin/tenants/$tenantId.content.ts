import { type Dictionary, t } from "intlayer";

// UI strings for the admin tenant edit screen. Read with useIntlayer("adminTenantEdit").
const adminTenantEditContent = {
  key: "adminTenantEdit",
  content: {
    back: t({ "en-us": "← Back to tenants", "es-us": "← Volver a inquilinos" }),
    name: t({ "en-us": "Name", "es-us": "Nombre" }),
    nameRequired: t({ "en-us": "Name is required", "es-us": "El nombre es obligatorio" }),
    save: t({ "en-us": "Save changes", "es-us": "Guardar cambios" }),
    saving: t({ "en-us": "Saving…", "es-us": "Guardando…" }),
    saved: t({ "en-us": "Tenant updated", "es-us": "Inquilino actualizado" }),
    updateFailed: t({ "en-us": "Couldn’t update tenant", "es-us": "No se pudo actualizar" }),
    deletedNotice: t({
      "en-us": "This tenant is deleted. Restore it to make it active again.",
      "es-us": "Este inquilino está eliminado. Restáuralo para reactivarlo.",
    }),
    delete: t({ "en-us": "Delete", "es-us": "Eliminar" }),
    deleting: t({ "en-us": "Deleting…", "es-us": "Eliminando…" }),
    deleted: t({ "en-us": "Tenant deleted", "es-us": "Inquilino eliminado" }),
    restore: t({ "en-us": "Restore", "es-us": "Restaurar" }),
    restoring: t({ "en-us": "Restoring…", "es-us": "Restaurando…" }),
    restored: t({ "en-us": "Tenant restored", "es-us": "Inquilino restaurado" }),
    permanentDelete: t({ "en-us": "Permanently delete", "es-us": "Eliminar permanentemente" }),
    permanentDeleting: t({ "en-us": "Deleting…", "es-us": "Eliminando…" }),
    permanentDeleted: t({
      "en-us": "Tenant permanently deleted",
      "es-us": "Inquilino eliminado permanentemente",
    }),
    confirmPermanent: t({
      "en-us": "Permanently delete this tenant? This cannot be undone.",
      "es-us": "¿Eliminar permanentemente este inquilino? No se puede deshacer.",
    }),
    actionFailed: t({ "en-us": "Action failed", "es-us": "La acción falló" }),
  },
} satisfies Dictionary;

export default adminTenantEditContent;
