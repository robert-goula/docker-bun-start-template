import { type Dictionary, t } from "intlayer";

const footerContent = {
  key: "footer",
  content: {
    rights: t({ "en-us": "All rights reserved.", "es-us": "Todos los derechos reservados." }),
  },
} satisfies Dictionary;

export default footerContent;
