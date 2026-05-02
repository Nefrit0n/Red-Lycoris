import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import type { GroupBy } from "@/lib/findings-filter";

// URL param name for expanded group keys. Format: CSV of group keys, e.g.
// ?expanded=CVE-2021-44228,CVE-2022-1337
const EXPANDED_PARAM = "expanded";

// useExpandedGroups tracks which group rows are open via the URL so that deep
// links and browser navigation preserve expansion state.
export function useExpandedGroups(groupBy: GroupBy) {
  const [searchParams, setSearchParams] = useSearchParams();

  const expanded = useMemo<Set<string>>(() => {
    const raw = searchParams.get(EXPANDED_PARAM);
    if (!raw) return new Set();
    return new Set(raw.split(",").filter(Boolean));
  }, [searchParams]);

  const setExpanded = useCallback(
    (next: Set<string>) => {
      setSearchParams(
        (prev) => {
          const p = new URLSearchParams(prev);
          if (next.size === 0) {
            p.delete(EXPANDED_PARAM);
          } else {
            p.set(EXPANDED_PARAM, Array.from(next).join(","));
          }
          return p;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const toggle = useCallback(
    (key: string) => {
      setExpanded(
        (() => {
          const next = new Set(expanded);
          if (next.has(key)) next.delete(key);
          else next.add(key);
          return next;
        })(),
      );
    },
    [expanded, setExpanded],
  );

  const expandAll = useCallback(
    (keys: string[]) => {
      setExpanded(new Set([...expanded, ...keys]));
    },
    [expanded, setExpanded],
  );

  const collapseAll = useCallback(() => {
    setExpanded(new Set());
  }, [setExpanded]);

  // Reset expansion when groupBy mode changes — stale keys become meaningless.
  const collapseAllForMode = useCallback(() => {
    setExpanded(new Set());
  }, [setExpanded]);

  void groupBy; // mode is accepted for API symmetry / future per-mode namespacing

  return { expanded, toggle, expandAll, collapseAll, collapseAllForMode };
}
