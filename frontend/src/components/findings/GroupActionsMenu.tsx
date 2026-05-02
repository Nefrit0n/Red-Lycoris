import { useState } from "react";
import { MoreHorizontal, X } from "lucide-react";

import { useBulkCloseGroup, useBulkStatusGroup } from "@/api/findings";
import type { FindingGroup } from "@/types";
import type { GroupBy } from "@/lib/findings-filter";
import { cn } from "@/lib/utils";

interface GroupActionsMenuProps {
  group: FindingGroup;
  groupBy: Exclude<GroupBy, "">;
  onCollapse?: () => void;
}

type ActionKey = "close_fp" | "close_fixed" | "close_risk" | "confirm" | "open";

const ACTION_LABELS: Record<ActionKey, string> = {
  close_fp: "Закрыть как ложное срабатывание",
  close_fixed: "Закрыть как исправленное",
  close_risk: "Закрыть как принятый риск",
  confirm: "Подтвердить",
  open: "Открыть",
};

interface Toast {
  type: "success" | "error" | "limit";
  message: string;
}

export function GroupActionsMenu({ group, groupBy, onCollapse }: GroupActionsMenuProps) {
  const [open, setOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<ActionKey | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);

  const bulkClose = useBulkCloseGroup();
  const bulkStatus = useBulkStatusGroup();

  const isPending = bulkClose.isPending || bulkStatus.isPending;

  const showToast = (t: Toast) => {
    setToast(t);
    setTimeout(() => setToast(null), 5000);
  };

  const confirm = async () => {
    if (!pendingAction) return;

    try {
      if (pendingAction === "close_fp" || pendingAction === "close_fixed" || pendingAction === "close_risk") {
        const reasonCode =
          pendingAction === "close_fp"
            ? "false_positive"
            : pendingAction === "close_fixed"
              ? "mitigated"
              : "acceptable_risk";
        await bulkClose.mutateAsync({
          groupBy,
          groupKey: group.group_key,
          reasonCode,
          note: "",
        });
      } else {
        const status = pendingAction === "confirm" ? 1 : 0;
        await bulkStatus.mutateAsync({
          groupBy,
          groupKey: group.group_key,
          status,
        });
      }
      setPendingAction(null);
      showToast({ type: "success", message: "Готово" });
      onCollapse?.();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Ошибка";
      if (msg.includes("BULK_LIMIT_EXCEEDED") || msg.includes("limit")) {
        showToast({
          type: "limit",
          message: "Слишком много находок в группе (>5000). Уточните фильтры.",
        });
      } else {
        showToast({ type: "error", message: msg });
      }
      setPendingAction(null);
    }
  };

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className={cn(
          "rounded p-1 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-200",
          open && "bg-zinc-800 text-zinc-200",
        )}
        aria-label="Действия с группой"
      >
        <MoreHorizontal className="size-4" />
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-7 z-50 min-w-[220px] rounded-lg border border-zinc-700 bg-zinc-900 py-1 shadow-xl">
            {(["close_fp", "close_fixed", "close_risk", "confirm", "open"] as ActionKey[]).map((action) => (
              <button
                key={action}
                type="button"
                className="w-full px-3 py-2 text-left text-sm text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
                onClick={(e) => {
                  e.stopPropagation();
                  setPendingAction(action);
                  setOpen(false);
                }}
              >
                {ACTION_LABELS[action]}
              </button>
            ))}
          </div>
        </>
      )}

      {pendingAction && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={() => { if (!isPending) setPendingAction(null); }}
        >
          <div
            className="w-full max-w-sm rounded-xl border border-zinc-700 bg-zinc-900 p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-2">
              <p className="text-sm font-medium text-zinc-100">
                {ACTION_LABELS[pendingAction]}
              </p>
              {!isPending && (
                <button
                  type="button"
                  onClick={() => setPendingAction(null)}
                  className="text-zinc-500 hover:text-zinc-300"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>
            <p className="mb-5 text-sm text-zinc-400">
              Будет обработано{" "}
              <span className="font-semibold text-zinc-200">
                {group.findings_count.toLocaleString("ru-RU")}
              </span>{" "}
              находок из группы. Это действие нельзя отменить.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void confirm()}
                disabled={isPending}
                className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50"
              >
                {isPending ? "Обработка…" : "Подтвердить"}
              </button>
              <button
                type="button"
                onClick={() => setPendingAction(null)}
                disabled={isPending}
                className="flex-1 rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800 disabled:opacity-50"
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div
          className={cn(
            "fixed bottom-6 right-6 z-50 flex max-w-sm items-center gap-3 rounded-xl border p-4 shadow-2xl text-sm",
            toast.type === "success" && "border-emerald-700 bg-emerald-950 text-emerald-200",
            toast.type === "error" && "border-red-800 bg-red-950 text-red-200",
            toast.type === "limit" && "border-amber-700 bg-amber-950 text-amber-200",
          )}
        >
          <span>{toast.message}</span>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="ml-auto opacity-60 hover:opacity-100"
          >
            <X className="size-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

export default GroupActionsMenu;
