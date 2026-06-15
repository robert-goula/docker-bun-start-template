import * as React from "react";
import { cx, cva, type VariantProps } from "class-variance-authority";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import styles from "./input-group.module.css";

function InputGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div data-slot="input-group" role="group" className={cx(styles.group, className)} {...props} />
  );
}

const inputGroupAddonVariants = cva(styles.addon, {
  variants: {
    align: {
      "inline-start": styles.addonInlineStart,
      "inline-end": styles.addonInlineEnd,
      "block-start": styles.addonBlockStart,
      "block-end": styles.addonBlockEnd,
    },
  },
  defaultVariants: {
    align: "inline-start",
  },
});

function InputGroupAddon({
  className,
  align = "inline-start",
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof inputGroupAddonVariants>) {
  return (
    <div
      role="group"
      data-slot="input-group-addon"
      data-align={align}
      className={cx(inputGroupAddonVariants({ align }), className)}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("button")) {
          return;
        }
        e.currentTarget.parentElement?.querySelector("input")?.focus();
      }}
      {...props}
    />
  );
}

const inputGroupButtonVariants = cva(styles.groupButton, {
  variants: {
    size: {
      xs: styles.groupButtonXs,
      sm: styles.groupButtonSm,
      "icon-xs": styles.groupButtonIconXs,
      "icon-sm": styles.groupButtonIconSm,
    },
  },
  defaultVariants: {
    size: "xs",
  },
});

function InputGroupButton({
  className,
  type = "button",
  variant = "ghost",
  size = "xs",
  ...props
}: Omit<React.ComponentProps<typeof Button>, "size" | "type"> &
  VariantProps<typeof inputGroupButtonVariants> & {
    type?: "button" | "submit" | "reset";
  }) {
  return (
    <Button
      type={type}
      data-size={size}
      variant={variant}
      className={cx(inputGroupButtonVariants({ size }), className)}
      {...props}
    />
  );
}

function InputGroupText({ className, ...props }: React.ComponentProps<"span">) {
  return <span className={cx(styles.text, className)} {...props} />;
}

function InputGroupInput({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <Input
      data-slot="input-group-control"
      className={cx(styles.groupInput, className)}
      {...props}
    />
  );
}

function InputGroupTextarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <Textarea
      data-slot="input-group-control"
      className={cx(styles.groupTextarea, className)}
      {...props}
    />
  );
}

export {
  InputGroup,
  InputGroupAddon,
  inputGroupAddonVariants,
  InputGroupButton,
  inputGroupButtonVariants,
  InputGroupText,
  InputGroupInput,
  InputGroupTextarea,
};
