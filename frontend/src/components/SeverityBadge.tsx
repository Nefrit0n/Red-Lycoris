import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const config: Record<number, { label: string; className: string }> = {
  0: {
    label: "Info",
    className: "border-zinc-600 bg-zinc-800/60 text-zinc-400",
  },
  1: {
    label: "Low",
    className: "border-blue-700/50 bg-blue-950/50 text-blue-400",
  },
  2: {
    label: "Medium",
    className: "border-yellow-700/50 bg-yellow-950/40 text-yellow-400",
  },
  3: {
    label: "High",
    className: "border-orange-700/50 bg-orange-950/40 text-orange-400",
  },
  4: {
    label: "Critical",
    className: "border-red-700/50 bg-red-950/40 text-red-400",
  },
};

interface SeverityBadgeProps {
  severity: number;
  className?: string;
}

export default function SeverityBadge({
  severity,
  className,
}: SeverityBadgeProps) {
  const c = config[severity] ?? config[0];
  return (
    <Badge variant="outline" className={cn(c.className, className)}>
      {c.label}
    </Badge>
  );
}
