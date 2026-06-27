import { type Dictionary, t } from "intlayer";

// UI strings for the admin users list. Co-located with index.tsx and excluded from
// file-based routing by vite.config's routeFileIgnorePattern. Read with
// useIntlayer("adminUsers"). The count/page summaries compose `of` + `users` so the word
// order works across locales (e.g. "1–20 of 100 users" / "1–20 de 100 usuarios").
const adminUsersContent = {
  key: "adminUsers",
  content: {
    title: t({ "en-us": "Users", "es-us": "Usuarios" }),
    searchPlaceholder: t({
      "en-us": "Search username or email…",
      "es-us": "Buscar usuario o correo…",
    }),
    colUsername: t({ "en-us": "Username", "es-us": "Usuario" }),
    colFirstName: t({ "en-us": "First name", "es-us": "Nombre" }),
    colLastName: t({ "en-us": "Last name", "es-us": "Apellido" }),
    colEmail: t({ "en-us": "Email", "es-us": "Correo electrónico" }),
    colRoles: t({ "en-us": "Roles", "es-us": "Roles" }),
    colCreated: t({ "en-us": "Created", "es-us": "Creado" }),
    noUsers: t({ "en-us": "No users found.", "es-us": "No se encontraron usuarios." }),
    noResults: t({ "en-us": "No results", "es-us": "Sin resultados" }),
    of: t({ "en-us": "of", "es-us": "de" }),
    users: t({ "en-us": "users", "es-us": "usuarios" }),
    page: t({ "en-us": "Page", "es-us": "Página" }),
    prev: t({ "en-us": "← Prev", "es-us": "← Anterior" }),
    next: t({ "en-us": "Next →", "es-us": "Siguiente →" }),
    perPage: t({ "en-us": "Per page", "es-us": "Por página" }),
  },
} satisfies Dictionary;

export default adminUsersContent;
