import { useEffect, useMemo, useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export type BulkStatusOption =
  | "open"
  | "confirmed"
  | "false_positive"
  | "fixed"
  | "accepted_risk";

interface BulkStatusCommentDialogProps {
  open: boolean;
  selectedCount: number;
  status: BulkStatusOption | null;
  pending?: boolean;
  error?: string | null;
  onClose: () => void;
  onSubmit: (note: string) => void;
}

const STATUS_LABEL: Record<BulkStatusOption, string> = {
  open: "Открыто",
  confirmed: "Подтверждено",
  false_positive: "Ложное",
  fixed: "Исправлено",
  accepted_risk: "Принят риск",
};

export default function BulkStatusCommentDialog({
  open,
  selectedCount,
  status,
  pending = false,
  error = null,
  onClose,
  onSubmit,
}: BulkStatusCommentDialogProps) {
  const [note, setNote] = useState("");

  useEffect(() => {
    if (open) {
      setNote("");
    }
  }, [open, status]);

  const statusLabel = useMemo(() => {
    if (!status) return "";
    return STATUS_LABEL[status];
  }, [status]);

  const canSubmit = note.trim().length > 0 && Boolean(status);

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="max-w-lg border-zinc-800 bg-zinc-900 text-zinc-100">
        <DialogHeader>
          <DialogTitle>Смена статуса</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-md border border-zinc-800 bg-zinc-950/70 p-3 text-sm text-zinc-200">
            Выбрано находок: <span className="font-semibold">{selectedCount}</span>
            {statusLabel ? (
              <div className="mt-1 text-zinc-400">
                Новый статус: <span className="text-zinc-200">{statusLabel}</span>
              </div>
            ) : null}
          </div>

          <div className="space-y-1">
            <label className="text-xs text-zinc-400">
              Причина смены статуса <span className="text-red-500">*</span>
            </label>
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={4}
              placeholder="Укажите комментарий"
              className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
            />
          </div>

          {error ? (
            <div className="rounded-md border border-red-700/40 bg-red-950/40 p-2 text-sm text-red-300">
              {error}
            </div>
          ) : null}
        </div>

        <DialogFooter className="mt-2 border-zinc-800 bg-zinc-900">
          <Button variant="outline" onClick={onClose} disabled={pending}>
            Отмена
          </Button>
          <Button onClick={() => onSubmit(note)} disabled={!canSubmit || pending}>
            Применить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
