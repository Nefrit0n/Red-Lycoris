import { MoreVertical } from "lucide-react";
import { useState } from "react";
import type { FindingsFilter, GroupBy } from "@/lib/findings-filter";
import { useBulkAssignGroup, useBulkCloseGroup, useBulkStatusGroup } from "@/api/findings";

export function GroupActionsMenu({ groupBy, groupKey, findingsCount, projectsCount, filter, onDone }: { groupBy: Exclude<GroupBy, "">; groupKey: string; findingsCount: number; projectsCount: number; filter: FindingsFilter; onDone?: () => void; }) {
  const [open, setOpen] = useState(false);
  const closeGroup = useBulkCloseGroup();
  const assignGroup = useBulkAssignGroup();
  const statusGroup = useBulkStatusGroup();

  const payloadBase = { group_by: groupBy, group_key: groupKey, filter };

  const run = async (kind: "close" | "assign" | "status") => {
    if (!window.confirm(`Применить действие к ${findingsCount} findings в ${projectsCount} проектах?`)) return;
    try {
      if (kind === "close") {
        await closeGroup.mutateAsync({ ...payloadBase, action: { reason_code: "mitigated", note: "group bulk close" } });
      } else if (kind === "status") {
        await statusGroup.mutateAsync({ ...payloadBase, action: { status: 1, note: "group bulk status" } });
      } else {
        const userID = window.prompt("UUID пользователя для назначения");
        if (!userID) return;
        await assignGroup.mutateAsync({ ...payloadBase, action: { user_id: userID } });
      }
      setOpen(false);
      onDone?.();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Ошибка";
      if (msg.includes("BULK_LIMIT_EXCEEDED")) {
        window.alert("Слишком много findings в группе (>5000), используйте ручную фильтрацию");
      } else {
        window.alert(msg);
      }
    }
  };

  return <div className="relative">
    <button type="button" aria-label="Действия с группой" onClick={() => setOpen((v) => !v)} className="rounded border border-zinc-700 p-1 text-zinc-300"><MoreVertical className="size-4"/></button>
    {open && <div className="absolute right-0 z-10 mt-1 w-44 rounded border border-zinc-700 bg-zinc-900 p-1 text-sm">
      <button className="block w-full rounded px-2 py-1 text-left hover:bg-zinc-800" onClick={() => run("close")}>Закрыть все</button>
      <button className="block w-full rounded px-2 py-1 text-left hover:bg-zinc-800" onClick={() => run("assign")}>Назначить</button>
      <button className="block w-full rounded px-2 py-1 text-left hover:bg-zinc-800" onClick={() => run("status")}>Изменить статус</button>
    </div>}
  </div>;
}
