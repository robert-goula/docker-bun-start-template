import * as React from "react";
import { Input as InputPrimitive } from "@base-ui/react/input";
import { cx } from "class-variance-authority";
import styles from "./input.module.css";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cx(styles.input, className)}
      {...props}
    />
  );
}

export { Input };
