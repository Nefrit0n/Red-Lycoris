import { useState, useRef } from "react";
import { cn } from "@/lib/utils";
import { hashString, PALETTE } from "./AvatarInitials";
import type { GroupRef } from "@/api/admin-users";

interface Props {
  groups: GroupRef[];
  maxVisible?: number;
}

function GroupChip({ group }: { group: GroupRef }) {
  const colorIdx = hashString(group.id) % PALETTE.length;
  const color = PALETTE[colorIdx];
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap select-none"
      style={{ backgroundColor: color.bg, color: color.fg }}
    >
      {group.name}
    </span>
  );
}

export function GroupsCell({ groups, maxVisible = 2 }: Props) {
  const [showAll, setShowAll] = useState(false);
  const overflowRef = useRef<HTMLSpanElement>(null);

  if (!groups || groups.length === 0) {
    return <span className="text-xs text-muted-foreground select-none">—</span>;
  }

  const visible = groups.slice(0, maxVisible);
  const hidden = groups.slice(maxVisible);

  return (
    <div className="flex flex-wrap gap-1 items-center">
      {visible.map((g) => (
        <GroupChip key={g.id} group={g} />
      ))}
      {hidden.length > 0 && (
        <span className="relative" ref={overflowRef}>
          <button
            type="button"
            className={cn(
              "inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium",
              "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors select-none"
            )}
            onClick={(e) => {
              e.stopPropagation();
              setShowAll((p) => !p);
            }}
          >
            +{hidden.length}
          </button>
          {showAll && (
            <>
              {/* Click-outside overlay */}
              <span
                className="fixed inset-0 z-40"
                onClick={() => setShowAll(false)}
              />
              <span
                className="absolute left-0 top-6 z-50 flex flex-col gap-1 p-2 rounded-lg border border-border bg-popover shadow-lg min-w-[140px]"
                onClick={(e) => e.stopPropagation()}
              >
                {hidden.map((g) => (
                  <GroupChip key={g.id} group={g} />
                ))}
              </span>
            </>
          )}
        </span>
      )}
    </div>
  );
}
