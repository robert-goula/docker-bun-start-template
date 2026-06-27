import { type Dictionary, t } from "intlayer";

// UI strings for the admin dashboard landing page. Read with useIntlayer("adminHome").
const adminHomeContent = {
  key: "adminHome",
  content: {
    heading: t({ "en-us": "Admin…", "es-us": "Administración…" }),
  },
} satisfies Dictionary;

export default adminHomeContent;
