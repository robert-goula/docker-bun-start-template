import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cx, cva, type VariantProps } from "class-variance-authority";

import styles from "./button.module.css";

const buttonVariants = cva(styles.btn, {
  variants: {
    intent: {
      neutral: styles.neutral,
      primary: styles.primary,
      secondary: styles.secondary,
      info: styles.info,
      warning: styles.warning,
      danger: styles.danger,
    },
    variant: {
      default: styles.default,
      outline: styles.outline,
      ghost: styles.ghost,
      link: styles.link,
    },
    size: {
      xs: styles.xs,
      sm: styles.sm,
      md: styles.md,
      lg: styles.lg,
      xl: styles.xl,
    },
  },
  defaultVariants: {
    intent: "neutral",
    variant: "default",
    size: "md",
  },
});

function Button({
  className,
  variant,
  intent,
  size,
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cx(
        buttonVariants({
          size,
          intent,
          variant,
          className,
        }),
      )}
      {...props}
    />
  );
}

export { Button, buttonVariants };
