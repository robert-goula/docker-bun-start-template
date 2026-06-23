import { type Dictionary, t } from "intlayer";

const languageSwitcherContent = {
  key: "languageSwitcher",
  content: {
    label: t({ "en-us": "Language", "es-us": "Idioma" }),
  },
} satisfies Dictionary;

export default languageSwitcherContent;
