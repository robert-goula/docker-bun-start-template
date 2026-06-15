import { Separator as SeparatorPrimitive } from "@base-ui/react/separator";

import { cx } from "class-variance-authority";
import styles from "./separator.module.css";

function Separator({ className, orientation = "horizontal", ...props }: SeparatorPrimitive.Props) {
  return (
    <SeparatorPrimitive
      data-slot="separator"
      orientation={orientation}
      className={cx(styles.separator, className)}
      {...props}
    />
  );
}

export { Separator };
