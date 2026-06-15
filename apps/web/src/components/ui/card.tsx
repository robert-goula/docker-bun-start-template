import * as React from "react";
import { cx, cva, type VariantProps } from "class-variance-authority";
import styles from "./card.module.css";

const cardVariants = cva(styles.card, {
  variants: {
    variant: {
      default: styles.default,
      inset: styles.sunken,
    },
    size: {
      md: styles.md,
      sm: styles.sm,
    },
  },
  defaultVariants: {
    variant: "default",
    size: "md",
  },
});

function Card({
  className,
  size,
  variant,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof cardVariants>) {
  return (
    <div data-slot="card" className={cx(cardVariants({ variant, size }), className)} {...props} />
  );
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-header" className={cx(styles.header, className)} {...props} />;
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-title" className={cx(styles.title, className)} {...props} />;
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div data-slot="card-description" className={cx(styles.description, className)} {...props} />
  );
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-action" className={cx(styles.action, className)} {...props} />;
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-content" className={cx(styles.content, className)} {...props} />;
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-footer" className={cx(styles.footer, className)} {...props} />;
}

export {
  Card,
  cardVariants,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
};
