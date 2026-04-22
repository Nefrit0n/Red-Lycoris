"use client";

import { Switch as BaseSwitch } from "@base-ui/react/switch";

import { cn } from "@/lib/utils";

function Switch({ className, ...props }: BaseSwitch.Root.Props) {
  return (
    <BaseSwitch.Root
      data-slot="switch"
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border border-zinc-700 bg-zinc-800 transition-colors data-[checked]:border-red-700/60 data-[checked]:bg-red-900/70 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-red-700/40 focus-visible:outline-none",
        className,
      )}
      {...props}
    >
      <BaseSwitch.Thumb
        className={cn(
          "block size-3.5 translate-x-0.5 rounded-full bg-zinc-200 shadow-sm transition-transform duration-150 data-[checked]:translate-x-[1.125rem] data-[checked]:bg-red-100",
        )}
      />
    </BaseSwitch.Root>
  );
}

export { Switch };
