import { useCallback, useEffect, useState } from "react";

// Tiny localStorage-backed state hook. Reads are lazy (only on mount) so
// consumers can use this in layout components without tripping SSR-style
// hydration warnings, and writes skip the round-trip when the value is
// structurally identical.

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw == null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function useLocalStorage<T>(
  key: string,
  fallback: T,
): [T, (next: T | ((prev: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => read(key, fallback));

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // quota/permission errors are non-fatal — we just skip persisting.
    }
  }, [key, value]);

  const update = useCallback(
    (next: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const resolved =
          typeof next === "function"
            ? (next as (prev: T) => T)(prev)
            : next;
        return resolved;
      });
    },
    [],
  );

  return [value, update];
}
