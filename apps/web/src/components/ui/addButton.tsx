import { cx } from "class-variance-authority";
import { AddIcon } from "@/components/icons";
import styles from "./addButton.module.css";

// The shared "add to a collection" affordance: dashed border + a leading plus icon + a two-word
// "Add <noun>" label (e.g. "Add widget", "Add field", "Add item"). Use this for appending to a
// list — NOT for primary/create form actions (those stay solid Buttons). Pass `block` to make it
// full-width on its own row; omit it to sit inline in a toolbar/row. Renders a real <button>, so
// it also works as a `render` target (e.g. a Dialog trigger).
type AddButtonProps = React.ComponentProps<"button"> & { block?: boolean };

function AddButton({ block = false, type = "button", className, children, ...props }: AddButtonProps) {
  return (
    <button
      type={type}
      data-slot="add-button"
      className={cx(styles.addButton, block && styles.block, className)}
      {...props}
    >
      <AddIcon aria-hidden="true" />
      {children}
    </button>
  );
}

export { AddButton };
