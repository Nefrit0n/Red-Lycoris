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

  if (iconOnly) {
    return (
      <Tooltip content={meta.label}>
        <span
          className={cn(
            "inline-flex size-5 items-center justify-center rounded text-current",
            meta.dotClass,
            className,
          )}
        >
          <Icon className="size-4" />
        </span>
      </Tooltip>
    );
  }

  const body = (
    <Badge
      variant="outline"
      className={cn("gap-1", meta.chipClass, className)}
    >
      <Icon className="size-3" />
      {!iconOnly && <span>{meta.short}</span>}
    </Badge>
  );
  return body;
}

export default KindBadge;
