import { Accordion as AccordionPrimitive } from "@base-ui/react/accordion";
import { cx } from "class-variance-authority";
import { ChevronDownIcon, ChevronUpIcon } from "lucide-react";

import styles from "./accordion.module.css";

function Accordion({ className, ...props }: AccordionPrimitive.Root.Props) {
  return (
    <AccordionPrimitive.Root
      data-slot="accordion"
      className={cx(styles.accordion, className)}
      {...props}
    />
  );
}

function AccordionItem({ className, ...props }: AccordionPrimitive.Item.Props) {
  return (
    <AccordionPrimitive.Item
      data-slot="accordion-item"
      className={cx(styles.accordionItem, className)}
      {...props}
    />
  );
}

function AccordionTrigger({ className, children, ...props }: AccordionPrimitive.Trigger.Props) {
  return (
    <AccordionPrimitive.Header className="flex">
      <AccordionPrimitive.Trigger
        data-slot="accordion-trigger"
        className={cx(styles.accordionTrigger, className)}
        {...props}
      >
        {children}
        <ChevronDownIcon data-slot="accordion-trigger-icon" className={styles.chevronDown} />
        <ChevronUpIcon data-slot="accordion-trigger-icon" className={styles.chevronUp} />
      </AccordionPrimitive.Trigger>
    </AccordionPrimitive.Header>
  );
}

function AccordionContent({ className, children, ...props }: AccordionPrimitive.Panel.Props) {
  return (
    <AccordionPrimitive.Panel
      data-slot="accordion-content"
      className={styles.accordionPanel}
      {...props}
    >
      <div className={cx(styles.accordionPanelInner, className)}>{children}</div>
    </AccordionPrimitive.Panel>
  );
}

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent };
