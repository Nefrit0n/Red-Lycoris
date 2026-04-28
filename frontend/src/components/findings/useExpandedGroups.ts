import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";

export function useExpandedGroups(groupBy: string) {
  const [params, setParams] = useSearchParams();
  const expanded = useMemo(() => {
    const raw = params.get("expanded") ?? "";
    const set = new Set<string>();
    raw.split(",").map((v) => v.trim()).filter(Boolean).forEach((token) => {
      const [mode, ...rest] = token.split(":");
      if (mode === groupBy && rest.length > 0) set.add(rest.join(":"));
    });
    return set;
  }, [groupBy, params]);

  const write = (next: Set<string>) => {
    const cloned = new URLSearchParams(params);
    const current = (cloned.get("expanded") ?? "").split(",").map((v) => v.trim()).filter(Boolean)
      .filter((token) => !token.startsWith(`${groupBy}:`));
    for (const key of next) current.push(`${groupBy}:${key}`);
    if (current.length === 0) cloned.delete("expanded"); else cloned.set("expanded", current.join(","));
    setParams(cloned, { replace: true });
  };

  return {
    expanded,
    toggle: (key: string) => {
      const next = new Set(expanded);
      if (next.has(key)) next.delete(key); else next.add(key);
      write(next);
    },
    expandAll: (keys: string[]) => write(new Set(keys)),
    collapseAll: () => write(new Set()),
  };
}
