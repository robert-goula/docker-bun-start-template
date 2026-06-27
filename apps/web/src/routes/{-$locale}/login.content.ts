import { type Dictionary, t } from "intlayer";

// UI strings for the login page. Co-located with login.tsx and excluded from file-based
// routing by vite.config's routeFileIgnorePattern. Read with useIntlayer("login").
const loginContent = {
  key: "login",
  content: {
    title: t({ "en-us": "Sign in", "es-us": "Iniciar sesión" }),
    description: t({
      "en-us": "Use your email and password.",
      "es-us": "Usa tu correo electrónico y contraseña.",
    }),
    errorTitle: t({ "en-us": "Sign in failed", "es-us": "Error al iniciar sesión" }),
    errorFallback: t({
      "en-us": "Invalid email or password",
      "es-us": "Correo electrónico o contraseña no válidos",
    }),
    emailLabel: t({ "en-us": "Email", "es-us": "Correo electrónico" }),
    emailPlaceholder: t({ "en-us": "user@example.com", "es-us": "usuario@ejemplo.com" }),
    passwordLabel: t({ "en-us": "Password", "es-us": "Contraseña" }),
    submit: t({ "en-us": "Sign in", "es-us": "Iniciar sesión" }),
    submitting: t({ "en-us": "Signing in…", "es-us": "Iniciando sesión…" }),
  },
} satisfies Dictionary;

export default loginContent;
