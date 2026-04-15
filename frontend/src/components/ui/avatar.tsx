import * as React from "react";

import { cn } from "@/lib/utils";

export function Avatar({ className, children }: React.ComponentProps<"div">) {
  return (
    <div className={cn("inline-flex items-center justify-center overflow-hidden rounded-full bg-zinc-800 text-zinc-200", className)}>
      {children}
    </div>
  );
}

export function AvatarFallback({ className, children }: React.ComponentProps<"span">) {
  return <span className={cn("text-[10px] font-medium uppercase", className)}>{children}</span>;
}
