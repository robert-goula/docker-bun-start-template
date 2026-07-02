import { type Dictionary, t } from "intlayer";

// UI strings for the tenant switcher. Co-located with TenantSwitcher.tsx and excluded
// from routing by vite.config's routeFileIgnorePattern.
const tenantSwitcherContent = {
  key: "tenantSwitcher",
  content: {
    label: t({ "en-us": "Switch tenant", "es-us": "Cambiar de inquilino" }),
    placeholder: t({ "en-us": "Select tenant", "es-us": "Seleccionar inquilino" }),
  },
} satisfies Dictionary;

export default tenantSwitcherContent;
