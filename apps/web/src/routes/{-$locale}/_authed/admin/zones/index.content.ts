import { type Dictionary, t } from "intlayer";

// UI strings for the admin zones list. Read with useIntlayer("adminZones").
const adminZonesContent = {
  key: "adminZones",
  content: {
    title: t({ "en-us": "Zones", "es-us": "Zonas" }),
    colName: t({ "en-us": "Name", "es-us": "Nombre" }),
    colCreated: t({ "en-us": "Created", "es-us": "Creado" }),
    noZones: t({ "en-us": "No zones yet.", "es-us": "Aún no hay zonas." }),
  },
} satisfies Dictionary;

export default adminZonesContent;
