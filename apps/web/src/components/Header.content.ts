import { type Dictionary, t } from "intlayer";

// UI strings for the site header. Co-located with Header.tsx and excluded from routing
// by vite.config's routeFileIgnorePattern. This is the example pattern for the team:
// add a `.content.ts` next to a component and read it with useIntlayer(key).
const headerContent = {
  key: "header",
  content: {
    home: t({ "en-us": "Home", "es-us": "Inicio" }),
    admin: t({ "en-us": "Admin", "es-us": "Administración" }),
    signIn: t({ "en-us": "Sign in", "es-us": "Iniciar sesión" }),
    signOut: t({ "en-us": "Sign out", "es-us": "Cerrar sesión" }),
    signingOut: t({ "en-us": "Signing out…", "es-us": "Cerrando sesión…" }),
  },
} satisfies Dictionary;

export default headerContent;
