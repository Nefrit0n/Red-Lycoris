import { useMemo } from "react";

import { FINDING_KINDS, findingKindMeta } from "@/lib/finding-kind";
import type { FindingsFilter } from "@/lib/findings-filter";
import type { FindingKind, FindingsFacets } from "@/types";
import { cn } from "@/lib/utils";

interface KindTabsProps {
  filter: FindingsFilter;
  onChange: (update: Partial<FindingsFilter>) => void;
  facets?: FindingsFacets;
}

// KindTabs renders the top-of-page tab strip that scopes the list to a
// specific finding kind (SCA, SAST, DAST, …). The "Все" tab clears the
// kinds filter entirely — when the user narrows into a kind we overwrite
// the array instead of adding, because the visual model is "one tab at a
// time", even though the filter itself can still hold several values.
export function KindTabs({ filter, onChange, facets }: KindTabsProps) {
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    facets?.by_kind?.forEach((b) => m.set(b.kind, b.count));
    return m;
  }, [facets]);

  const total = useMemo(() => {
    let sum = 0;
    counts.forEach((v) => {
      sum += v;
    });
    return sum;
  }, [counts]);

  const activeKind: FindingKind | null =
    filter.kinds.length === 1 ? filter.kinds[0] : null;

  const selectKind = (kind: FindingKind | null) => {
    // Kind tabs are a scope switch; always reset grouping to flat list so
    // users don't end up in an unexpected grouped mode after tab changes.
    onChange({ kinds: kind ? [kind] : [], groupBy: "" });
  };

  return (
    <div className="flex items-center gap-1 overflow-x-auto border-b border-zinc-800 bg-zinc-950/40 px-4">
      <TabButton
        active={activeKind === null && filter.kinds.length === 0}
        label="Все"
        count={total}
        onClick={() => selectKind(null)}
      />
      {FINDING_KINDS.map((kind) => {
        const meta = findingKindMeta(kind);
        const Icon = meta.icon;
        return (
          <TabButton
            key={kind}
            active={activeKind === kind}
            label={meta.short}
            count={counts.get(kind)}
            onClick={() => selectKind(kind)}
            icon={
              <Icon
                className={cn(
                  "size-3.5 transition-colors",
                  activeKind === kind ? meta.dotClass : "text-zinc-500",
                )}
              />
            }
          />
        );
      })}
    </div>
  );
}

function TabButton({
  active,
  label,
  count,
  onClick,
  icon,
}: {
  active: boolean;
  label: string;
  count?: number;
  onClick: () => void;
  icon?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative flex items-center gap-1.5 rounded-t-md border-b border-transparent px-3 py-2.5 text-sm transition-colors",
        active
          ? "border-b-2 border-red-500 font-semibold text-zinc-100"
          : "text-zinc-500 hover:border-zinc-700 hover:bg-zinc-900/40 hover:text-zinc-300",
      )}
    >
      {icon}
      <span>{label}</span>
      {typeof count === "number" && count > 0 && (
        <span
          className={cn(
            "tabular-nums rounded-full px-1.5 text-[10px] font-medium",
            active
              ? "bg-red-700/20 text-red-300"
              : "border border-zinc-700 text-zinc-500",
          )}
        >
          {count.toLocaleString("ru-RU")}
        </span>
      )}
    </button>
  );
}

export default KindTabs;
