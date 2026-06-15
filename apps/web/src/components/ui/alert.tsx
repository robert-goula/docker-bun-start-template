import * as React from "react";
import { cx, cva, type VariantProps } from "class-variance-authority";
import { X } from "lucide-react";

import styles from "./alert.module.css";

const alertVariants = cva(styles.alert, {
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
      link: styles.link,
    },
  },
  defaultVariants: {
    intent: "neutral",
    variant: "default",
  },
});

function Alert({
  className,
  intent,
  variant,
  dismissable,
  onDismiss,
  children,
  ...props
}: React.ComponentProps<"div"> &
  VariantProps<typeof alertVariants> & {
    dismissable?: boolean;
    onDismiss?: () => void;
  }) {
  const [dismissed, setDismissed] = React.useState(false);

  if (dismissed) return null;

  function handleDismiss() {
    setDismissed(true);
    onDismiss?.();
  }

  return (
    <div
      data-slot="alert"
      role="alert"
      className={cx(alertVariants({ intent, variant }), className)}
      {...props}
    >
      {children}
      {dismissable && (
        <button
          data-slot="alert-dismiss"
          className={styles.dismiss}
          onClick={handleDismiss}
          aria-label="Dismiss"
          type="button"
        >
          <X />
        </button>
      )}
    </div>
  );
}

function AlertTitle({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="alert-title" className={cx(styles.title, className)} {...props} />;
}

function AlertDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div data-slot="alert-description" className={cx(styles.description, className)} {...props} />
  );
}

function AlertAction({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="alert-action" className={cx(styles.action, className)} {...props} />;
}

export { Alert, alertVariants, AlertTitle, AlertDescription, AlertAction };
