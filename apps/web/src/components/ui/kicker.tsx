import { type ReactNode } from "react";
import { cx } from "class-variance-authority";
import styles from "./kicker.module.css";
type KickerProps = {
  children: ReactNode;
};
export function Kicker({ children }: KickerProps) {
  return <p className={cx(styles.kicker)}>{children}</p>;
}
