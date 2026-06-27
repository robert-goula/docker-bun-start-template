import { Radio as RadioPrimitive } from "@base-ui/react/radio";
import { RadioGroup as RadioGroupPrimitive } from "@base-ui/react/radio-group";
import { cx } from "class-variance-authority";
import styles from "./radio-group.module.css";

function RadioGroup({ className, ...props }: RadioGroupPrimitive.Props) {
  return (
    <RadioGroupPrimitive
      data-slot="radio-group"
      className={cx(styles.group, className)}
      {...props}
    />
  );
}

// One labeled radio option: the circle (Base UI Radio) plus its label text. `value` identifies the
// option within the group.
function RadioGroupItem({
  className,
  children,
  value,
  disabled,
  ...props
}: Omit<React.ComponentProps<"label">, "onChange"> & {
  value: RadioPrimitive.Root.Props["value"];
  disabled?: boolean;
}) {
  return (
    <label data-slot="radio-group-item" className={cx(styles.item, className)} {...props}>
      <RadioPrimitive.Root value={value} disabled={disabled} className={styles.radio}>
        <RadioPrimitive.Indicator className={styles.indicator} />
      </RadioPrimitive.Root>
      <span className={styles.label}>{children}</span>
    </label>
  );
}

export { RadioGroup, RadioGroupItem };
