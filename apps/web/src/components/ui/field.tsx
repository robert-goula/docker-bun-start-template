import { useMemo } from "react";
import { cx, cva, type VariantProps } from "class-variance-authority";
import { Separator as SeparatorPrimitive } from "@base-ui/react/separator";

import styles from "./field.module.css";

function FieldGroup({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="field-group" className={cx(styles.group, className)} {...props} />;
}

function FieldSet({ className, ...props }: React.ComponentProps<"fieldset">) {
  return <fieldset data-slot="field-set" className={cx(styles.fieldSet, className)} {...props} />;
}

function FieldLegend({
  className,
  variant = "legend",
  ...props
}: React.ComponentProps<"legend"> & { variant?: "legend" | "label" }) {
  return (
    <legend
      data-slot="field-legend"
      data-variant={variant}
      className={cx(styles.legend, className)}
      {...props}
    />
  );
}

const fieldVariants = cva(styles.field, {
  variants: {
    orientation: {
      vertical: styles.vertical,
      horizontal: styles.horizontal,
      responsive: styles.responsive,
    },
  },
  defaultVariants: {
    orientation: "vertical",
  },
});

function Field({
  className,
  orientation,
  ...props
}: React.ComponentProps<"dl"> & VariantProps<typeof fieldVariants>) {
  return (
    <dl
      data-slot="field"
      data-orientation={orientation}
      className={cx(fieldVariants({ orientation }), className)}
      {...props}
    />
  );
}

function FieldLabel({
  className,
  labelClassName,
  children,
  htmlFor,
  ...props
}: React.ComponentProps<"dt"> & {
  labelClassName?: string;
  htmlFor?: string;
}) {
  return (
    <dt data-slot="field-label" className={cx(styles.term, className)} {...props}>
      <label htmlFor={htmlFor} className={cx(styles.label, labelClassName)}>
        {children}
      </label>
    </dt>
  );
}

function FieldTitle({ className, ...props }: React.ComponentProps<"dt">) {
  return <dt data-slot="field-title" className={cx(styles.title, className)} {...props} />;
}

function FieldBody({ className, ...props }: React.ComponentProps<"dd">) {
  return <dd data-slot="field-body" className={cx(styles.body, className)} {...props} />;
}

function FieldDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p data-slot="field-description" className={cx(styles.description, className)} {...props} />
  );
}

function FieldSeparator({
  children,
  className,
  ...props
}: React.ComponentProps<"div"> & {
  children?: React.ReactNode;
}) {
  return (
    <div
      data-slot="field-separator"
      data-content={!!children || undefined}
      className={cx(styles.separator, className)}
      {...props}
    >
      <SeparatorPrimitive className={styles.separatorLine} />
      {children && (
        <span data-slot="field-separator-content" className={styles.separatorContent}>
          {children}
        </span>
      )}
    </div>
  );
}

function FieldError({
  className,
  children,
  errors,
  ...props
}: React.ComponentProps<"div"> & {
  errors?: Array<{ message?: string } | undefined>;
}) {
  const content = useMemo(() => {
    if (children) {
      return children;
    }

    if (!errors?.length) {
      return null;
    }

    const uniqueErrors = [...new Map(errors.map((error) => [error?.message, error])).values()];

    if (uniqueErrors?.length == 1) {
      return uniqueErrors[0]?.message;
    }

    return (
      <ul className={styles.errorList}>
        {uniqueErrors.map((error, index) => error?.message && <li key={index}>{error.message}</li>)}
      </ul>
    );
  }, [children, errors]);

  if (!content) {
    return null;
  }

  return (
    <div role="alert" data-slot="field-error" className={cx(styles.error, className)} {...props}>
      {content}
    </div>
  );
}

export {
  Field,
  fieldVariants,
  FieldBody,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSeparator,
  FieldSet,
  FieldTitle,
};
