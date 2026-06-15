import * as React from "react";
import { cva, cx, type VariantProps } from "class-variance-authority";
import styles from "./typography.module.css";

const headlineVariants = cva(styles.hdr, {
  variants: {
    size: {
      xs: styles.xs,
      sm: styles.sm,
      default: styles.md,
      md: styles.md,
      lg: styles.lg,
      xl: styles.xl,
      xxl: styles.xxl,
      xxxl: styles.xxxl,
      xxxxl: styles.xxxxl,
    },
  },
});

type HeadlineTag = "h1" | "h2" | "h3" | "h4" | "h5" | "h6";

export interface HeadlineProps
  extends React.HTMLAttributes<HTMLHeadingElement>, VariantProps<typeof headlineVariants> {
  as?: HeadlineTag;
}

export function Headline({ className, size, as: Component = "h1", ...props }: HeadlineProps) {
  return <Component className={cx(headlineVariants({ size, className }))} {...props} />;
}
