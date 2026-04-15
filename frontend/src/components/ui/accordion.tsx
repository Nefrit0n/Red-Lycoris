"use client";

import { Accordion as BaseAccordion } from "@base-ui/react/accordion";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

function Accordion(props: BaseAccordion.Root.Props) {
  return <BaseAccordion.Root data-slot="accordion" {...props} />;
}

function AccordionItem({ className, ...props }: BaseAccordion.Item.Props) {
  return (
    <BaseAccordion.Item
      data-slot="accordion-item"
      className={cn("border-b border-zinc-800 last:border-b-0", className)}
      {...props}
    />
  );
}

function AccordionHeader({ className, ...props }: BaseAccordion.Header.Props) {
  return (
    <BaseAccordion.Header
      data-slot="accordion-header"
      className={cn("flex", className)}
      {...props}
    />
  );
}

function AccordionTrigger({
  className,
  children,
  ...props
}: BaseAccordion.Trigger.Props) {
  return (
    <BaseAccordion.Trigger
      data-slot="accordion-trigger"
      className={cn(
        "group flex flex-1 items-center justify-between gap-2 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-zinc-400 transition-colors hover:text-zinc-200",
        className,
      )}
      {...props}
    >
      {children}
      <ChevronDown className="size-3.5 shrink-0 text-zinc-500 transition-transform duration-200 group-data-[panel-open]:rotate-180" />
    </BaseAccordion.Trigger>
  );
}

function AccordionPanel({ className, ...props }: BaseAccordion.Panel.Props) {
  return (
    <BaseAccordion.Panel
      data-slot="accordion-panel"
      className={cn(
        "overflow-hidden pb-3 text-sm transition-[height] duration-200 data-[panel-closed]:h-0 data-[panel-open]:h-[var(--accordion-panel-height)]",
        className,
      )}
      {...props}
    />
  );
}

export {
  Accordion,
  AccordionItem,
  AccordionHeader,
  AccordionTrigger,
  AccordionPanel,
};
