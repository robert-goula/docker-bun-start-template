import { InputControl, NumberControl, TextareaControl } from "./fieldControls/controls";
import type { Plugin } from "./types";

// The built-in text controls, registered as the reference plugin. Also subscribes to the
// `widget:save` lifecycle event as a demonstration that the on/trigger path works end to
// end — replace or remove this listener once a real consumer exists.
export const textFieldsPlugin: Plugin = {
  name: "text-fields",
  setup(api) {
    api.registerFieldControl("input", InputControl);
    api.registerFieldControl("textarea", TextareaControl);

    api.bus.on("widget:save", ({ definitionId, values }) => {
      console.debug("[plugins] widget:save", definitionId, values);
    });
  },
};

// The number control, registered as its own plugin to demonstrate adding a new control:
// declare its key + advanced config in the descriptor, then register a component here.
export const numberFieldPlugin: Plugin = {
  name: "number-field",
  setup(api) {
    api.registerFieldControl("number", NumberControl);
  },
};
