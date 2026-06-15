import * as React from "react";

import { cx } from "class-variance-authority";
import styles from "./label.module.css";

function Label({ className, ...props }: React.ComponentProps<"label">) {
  return <label data-slot="label" className={cx(styles.label, className)} {...props} />;
}

export { Label };
