import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox";
import { CheckboxGroup as CheckboxGroupPrimitive } from "@base-ui/react/checkbox-group";
import { cx } from "class-variance-authority";
import { CheckIcon } from "lucide-react";
import styles from "./checkbox.module.css";

// A shared-state container for a set of checkboxes. Its `value`/`onValueChange` track the array of
// ticked checkbox `name`s.
function CheckboxGroup({ className, ...props }: CheckboxGroupPrimitive.Props) {
  return (
    <CheckboxGroupPrimitive
      data-slot="checkbox-group"
      className={cx(styles.group, className)}
      {...props}
    />
  );
}

// The bare checkbox box + tick, usable on its own (controlled via `checked`/`onCheckedChange`) or
// inside a CheckboxGroup (tracked by `name`).
function Checkbox({ className, ...props }: CheckboxPrimitive.Root.Props) {
  return (
    <CheckboxPrimitive.Root data-slot="checkbox" className={cx(styles.box, className)} {...props}>
      <CheckboxPrimitive.Indicator className={styles.indicator}>
        <CheckIcon />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

// One labeled checkbox option for use inside a CheckboxGroup. `name` is the value tracked by the
// group's selected array.
function CheckboxGroupItem({
  className,
  children,
  name,
  disabled,
  ...props
}: Omit<React.ComponentProps<"label">, "onChange"> & {
  name: string;
  disabled?: boolean;
}) {
  return (
    <label data-slot="checkbox-group-item" className={cx(styles.item, className)} {...props}>
      <Checkbox name={name} disabled={disabled} />
      <span className={styles.label}>{children}</span>
    </label>
  );
}

export { Checkbox, CheckboxGroup, CheckboxGroupItem };
