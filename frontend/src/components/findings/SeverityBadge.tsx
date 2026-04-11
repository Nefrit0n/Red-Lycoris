import { Badge } from "@/components/ui/badge";
import { severityMeta } from "@/lib/severity";
import { cn } from "@/lib/utils";

interface SeverityBadgeProps {
  severity: number;
  className?: string;
  short?: boolean;
}

export function SeverityBadge({
  severity,
  className,
  short,
}: SeverityBadgeProps) {
  const meta = severityMeta(severity);
  return (
    <Badge variant="outline" className={cn(meta.badgeClass, className)}>
      {short ? meta.short : meta.label}
    </Badge>
  );
}

export default SeverityBadge;
