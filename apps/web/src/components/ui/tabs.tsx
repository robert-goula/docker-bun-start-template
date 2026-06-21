import { Activity } from "react";
import { Tabs as TabsPrimitive } from "@base-ui/react/tabs";
import { cva, cx, type VariantProps } from "class-variance-authority";
import styles from "./tabs.module.css";

function Tabs({ className, orientation = "horizontal", ...props }: TabsPrimitive.Root.Props) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      data-orientation={orientation}
      className={cx(styles.tabs, className)}
      {...props}
    />
  );
}

const tabsListVariants = cva(styles.tabsList, {
  variants: {
    variant: {
      default: "",
      line: styles.tabsListLine,
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

function TabsList({
  className,
  variant = "default",
  ...props
}: TabsPrimitive.List.Props & VariantProps<typeof tabsListVariants>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant={variant}
      className={cx(tabsListVariants({ variant }), className)}
      {...props}
    />
  );
}

function TabsTrigger({ className, ...props }: TabsPrimitive.Tab.Props) {
  return (
    <TabsPrimitive.Tab
      data-slot="tabs-trigger"
      className={cx(styles.tabsTrigger, className)}
      {...props}
    />
  );
}

// Panels stay mounted (`keepMounted`) and React's `Activity` drives visibility off the
// panel's `hidden` state, so input values persist across tab switches instead of being
// torn down and rebuilt each time a tab becomes inactive.
function TabsContent({ className, children, ...props }: TabsPrimitive.Panel.Props) {
  return (
    <TabsPrimitive.Panel
      data-slot="tabs-content"
      keepMounted
      className={cx(styles.tabsContent, className)}
      render={(panelProps, state) => (
        <div {...panelProps}>
          <Activity mode={state.hidden ? "hidden" : "visible"}>{children}</Activity>
        </div>
      )}
      {...props}
    />
  );
}

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants };
