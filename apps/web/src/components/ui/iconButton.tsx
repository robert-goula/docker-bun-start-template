import { cx } from "class-variance-authority";
import styles from "./iconButton.module.css";

// Icon-only action button (edit, delete, visibility, reorder, …). `aria-label` is required since
// there's no visible text. `tone="danger"` turns the icon red on hover for destructive actions;
// the default ("neutral") tints to the primary colour on hover. Renders a real <button>, so it
// works directly and as a `render` target (e.g. a Dialog/Tooltip trigger).
type IconButtonProps = React.ComponentProps<"button"> & {
  "aria-label": string;
  tone?: "neutral" | "danger";
};

function IconButton({ tone = "neutral", type = "button", className, ...props }: IconButtonProps) {
  return (
    <button
      type={type}
      data-slot="icon-button"
      className={cx(styles.iconButton, tone === "danger" && styles.danger, className)}
      {...props}
    />
  );
}

export { IconButton };
