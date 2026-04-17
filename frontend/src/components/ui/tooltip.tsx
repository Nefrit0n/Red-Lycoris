import * as React from "react";
import { Tooltip as BaseTooltip } from "@base-ui/react/tooltip";

import { cn } from "@/lib/utils";

// Thin shadcn-style wrapper around @base-ui/react Tooltip. We expose a single
// <Tooltip content="..."> component that handles Root/Trigger/Portal/Popup in
// one shot — every call site only needs to wrap its trigger element.

interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactElement;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
  className?: string;
}

export function TooltipProvider({ children }: { children: React.ReactNode }) {
  return <BaseTooltip.Provider delay={200}>{children}</BaseTooltip.Provider>;
}

export function Tooltip({
  content,
  children,
  side = "top",
  align = "center",
  className,
}: TooltipProps) {
  if (content == null || content === "") {
    return children;
  }
  return (
    <BaseTooltip.Root>
      <BaseTooltip.Trigger render={children} />
      <BaseTooltip.Portal>
        <BaseTooltip.Positioner side={side} align={align} sideOffset={6}>
          <BaseTooltip.Popup
            className={cn(
              "z-[80] max-w-xs rounded-md border border-zinc-700 bg-zinc-900/95 px-2.5 py-1.5 text-xs text-zinc-200 shadow-lg backdrop-blur",
              className,
            )}
          >
            {content}
          </BaseTooltip.Popup>
        </BaseTooltip.Positioner>
      </BaseTooltip.Portal>
    </BaseTooltip.Root>
  );
}
