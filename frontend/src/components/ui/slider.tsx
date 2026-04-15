"use client";

import { Slider as BaseSlider } from "@base-ui/react/slider";

import { cn } from "@/lib/utils";

interface SliderProps {
  value: number;
  onValueChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  className?: string;
}

// Thin wrapper around @base-ui/react Slider that always renders a single
// thumb. The full ranged API is available on the base component; we don't
// expose it yet because the only caller — filter thresholds — uses a single
// "at least" cutoff.
function Slider({
  value,
  onValueChange,
  min = 0,
  max = 100,
  step = 1,
  disabled,
  className,
}: SliderProps) {
  return (
    <BaseSlider.Root
      value={value}
      onValueChange={(next) => {
        if (typeof next === "number") {
          onValueChange(next);
        }
      }}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      className={cn("relative flex h-5 w-full items-center", className)}
    >
      <BaseSlider.Control className="relative flex h-5 w-full items-center">
        <BaseSlider.Track className="relative h-1 w-full overflow-hidden rounded-full bg-zinc-800">
          <BaseSlider.Indicator className="absolute h-full rounded-full bg-red-700/70" />
        </BaseSlider.Track>
        <BaseSlider.Thumb className="block size-3.5 rounded-full border border-red-600 bg-red-500 shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-red-700/40" />
      </BaseSlider.Control>
    </BaseSlider.Root>
  );
}

export { Slider };
