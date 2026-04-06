import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const config: Record<number, { label: string; className: string }> = {
  0: {
    label: "Open",
    className: "border-blue-700/50 bg-blue-950/50 text-blue-400",
  },
  1: {
    label: "Confirmed",
    className: "border-violet-700/50 bg-violet-950/50 text-violet-400",
  },
  2: {
    label: "False Positive",
    className: "border-zinc-600 bg-zinc-800/60 text-zinc-400",
  },
  3: {
    label: "Resolved",
    className: "border-emerald-700/50 bg-emerald-950/40 text-emerald-400",
  },
  4: {
    label: "Risk Accepted",
    className: "border-amber-700/50 bg-amber-950/40 text-amber-400",
  },
};

interface StatusBadgeProps {
  status: number;
  className?: string;
}

export default function StatusBadge({ status, className }: StatusBadgeProps) {
  const c = config[status] ?? config[0];
  return (
    <Badge variant="outline" className={cn(c.className, className)}>
      {c.label}
    </Badge>
  );
}
