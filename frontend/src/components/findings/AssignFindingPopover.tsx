import { useMemo, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  useAssignFinding,
  useAssignableUsers,
  useBulkAssign,
  useUnassignFinding,
} from "@/api/findings";

interface AssignFindingPopoverProps {
  findingIds: string[];
  projectId: string;
  currentAssigneeId?: string;
  children: ReactNode;
}

export default function AssignFindingPopover({
  findingIds,
  projectId,
  currentAssigneeId,
  children,
}: AssignFindingPopoverProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { data } = useAssignableUsers(projectId);
  const assign = useAssignFinding();
  const unassign = useUnassignFinding();
  const bulkAssign = useBulkAssign();

  const users = data?.data ?? [];
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => `${u.email} ${u.full_name}`.toLowerCase().includes(q));
  }, [users, query]);

  function handleAssign(userId: string) {
    setError(null);
    if (findingIds.length === 1) {
      assign.mutate(
        { id: findingIds[0], userId },
        {
          onSuccess: () => setOpen(false),
          onError: (e) => setError(e instanceof Error ? e.message : "Не удалось назначить"),
        },
      );
      return;
    }

    bulkAssign.mutate(
      { ids: findingIds, userId },
      {
        onSuccess: () => setOpen(false),
        onError: (e) => setError(e instanceof Error ? e.message : "Не удалось назначить"),
      },
    );
  }

  return (
    <div className="relative inline-block">
      <button type="button" onClick={() => setOpen((v) => !v)} className="contents">
        {children}
      </button>

      {open ? (
        <div className="absolute right-0 z-40 mt-2 w-80 rounded-lg border border-zinc-800 bg-zinc-900 p-2 shadow-lg">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск пользователя..."
            className="mb-2 h-9 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 text-sm"
          />

          {currentAssigneeId && findingIds.length === 1 ? (
            <Button
              variant="ghost"
              className="mb-1 w-full justify-start text-zinc-300"
              onClick={() =>
                unassign.mutate(
                  { id: findingIds[0] },
                  {
                    onSuccess: () => setOpen(false),
                    onError: (e) => setError(e instanceof Error ? e.message : "Не удалось снять назначение"),
                  },
                )
              }
            >
              Снять назначение
            </Button>
          ) : null}

          <div className="max-h-64 overflow-auto">
            {filtered.map((user) => (
              <button
                key={user.id}
                type="button"
                onClick={() => handleAssign(user.id)}
                className="w-full rounded-md px-2 py-2 text-left text-sm hover:bg-zinc-800"
              >
                <div className="text-zinc-100">{user.full_name || user.email}</div>
                <div className="text-xs text-zinc-500">{user.email}</div>
              </button>
            ))}
          </div>

          {error ? <div className="mt-2 text-xs text-red-400">{error}</div> : null}
        </div>
      ) : null}
    </div>
  );
}
