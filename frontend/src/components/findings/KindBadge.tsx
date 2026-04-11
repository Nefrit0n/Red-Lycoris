import { Badge } from "@/components/ui/badge";
import { Tooltip } from "@/components/ui/tooltip";
import { findingKindMeta } from "@/lib/finding-kind";
import { cn } from "@/lib/utils";
import type { FindingKind } from "@/types";

interface KindBadgeProps {
  kind: FindingKind | string | undefined | null;
  className?: string;
  iconOnly?: boolean;
}

export function KindBadge({ kind, className, iconOnly }: KindBadgeProps) {
  const meta = findingKindMeta(kind ?? undefined);
  const Icon = meta.icon;

  const body = (
    <Badge
      variant="outline"
      className={cn("gap-1", meta.chipClass, className)}
    >
      <Icon className="size-3" />
      {!iconOnly && <span>{meta.short}</span>}
    </Badge>
  );

  if (!iconOnly) {
    return body;
  }
  return <Tooltip content={meta.label}>{body}</Tooltip>;
}

export default KindBadge;
