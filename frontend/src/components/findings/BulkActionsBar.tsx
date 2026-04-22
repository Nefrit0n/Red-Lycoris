import { useMemo, useState } from "react";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import CloseFindingDialog from "@/components/findings/CloseFindingDialog";
import AssignFindingPopover from "@/components/findings/AssignFindingPopover";
import { useBulkUpdateStatus } from "@/api/findings";

interface BulkActionsBarProps {
  selected: Set<string>;
  onClear: () => void;
  projectId?: string;
}

export default function BulkActionsBar({ selected, onClear, projectId }: BulkActionsBarProps) {
  const bulkUpdateStatus = useBulkUpdateStatus();
  const [closeOpen, setCloseOpen] = useState(false);
  const [failedOpen, setFailedOpen] = useState(false);

  const ids = useMemo(() => Array.from(selected), [selected]);
  const failed = (bulkUpdateStatus.error as { details?: Record<string, unknown> } | null)?.details;

  if (selected.size === 0) return null;

  return (
    <>
      <div className="fixed inset-x-0 bottom-0 z-50 translate-y-0 border-t border-zinc-800 bg-zinc-900/95 px-4 py-3 shadow-lg transition-transform">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-2">
          <div className="text-sm text-zinc-300">Выбрано {selected.size}</div>

          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="outline" size="sm" className="border-zinc-700 bg-zinc-900 text-zinc-300">
                  Сменить статус ▼
                </Button>
              }
            />
            <DropdownMenuContent className="border-zinc-700 bg-zinc-900">
              <DropdownMenuItem onClick={() => bulkUpdateStatus.mutate({ ids, status: 0 })}>Открыта</DropdownMenuItem>
              <DropdownMenuItem onClick={() => bulkUpdateStatus.mutate({ ids, status: 1 })}>Подтверждена</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button variant="outline" size="sm" onClick={() => setCloseOpen(true)} className="border-zinc-700 bg-zinc-900 text-zinc-300">
            Закрыть...
          </Button>

          {projectId ? (
            <AssignFindingPopover findingIds={ids} projectId={projectId}>
              <Button variant="outline" size="sm" className="border-zinc-700 bg-zinc-900 text-zinc-300">Назначить...</Button>
            </AssignFindingPopover>
          ) : null}

          <Button variant="ghost" size="sm" onClick={onClear} className="ml-auto text-zinc-400 hover:text-zinc-200">
            <X className="mr-1 h-4 w-4" /> Снять выбор
          </Button>
        </div>

        {failed ? (
          <div className="mx-auto mt-2 max-w-6xl rounded border border-zinc-700 bg-zinc-950/70 p-2 text-xs text-zinc-300">
            <button type="button" onClick={() => setFailedOpen((v) => !v)} className="underline">
              {failedOpen ? "Скрыть" : "Показать"} ошибки
            </button>
            {failedOpen ? <pre className="mt-2 whitespace-pre-wrap text-[11px]">{JSON.stringify(failed, null, 2)}</pre> : null}
          </div>
        ) : null}
      </div>

      {closeOpen ? (
        <CloseFindingDialog findingIds={ids} isOpen={closeOpen} onClose={() => setCloseOpen(false)} />
      ) : null}
    </>
  );
}
