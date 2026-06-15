import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cx, cva, type VariantProps } from "class-variance-authority";

import styles from "./badge.module.css";

const badgeVariants = cva(styles.badge, {
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

function Badge({
  className,
  intent,
  variant,
  size,
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      { className: cx(badgeVariants({ intent, variant, size }), className) },
      props,
    ),
    render,
    state: { slot: "badge" },
  });
}

export { Badge, badgeVariants };
