import { useMemo, useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useBulkClose, useCloseFinding, useClosureReasons } from "@/api/findings";

interface CloseFindingDialogProps {
  findingIds: string[];
  onClose: () => void;
  isOpen: boolean;
}

export default function CloseFindingDialog({ findingIds, onClose, isOpen }: CloseFindingDialogProps) {
  const singleId = findingIds.length === 1 ? findingIds[0] : null;
  const { data } = useClosureReasons();
  const closeFinding = useCloseFinding();
  const bulkClose = useBulkClose();

  const reasons = useMemo(
    () =>
      [...(data?.data ?? [])].sort(
        (a, b) => ((a as { sort_order?: number }).sort_order ?? a.id) - ((b as { sort_order?: number }).sort_order ?? b.id),
      ),
    [data],
  );

  const [reasonCode, setReasonCode] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const selectedReason = reasons.find((r) => r.code === reasonCode);
  const noteRequired = Boolean(selectedReason?.requires_note);
  const canSubmit = Boolean(selectedReason) && (!noteRequired || note.trim() !== "");

  const pending = closeFinding.isPending || bulkClose.isPending;

  function resetAndClose() {
    setReasonCode("");
    setNote("");
    setError(null);
    onClose();
  }

  function onSubmit() {
    if (!selectedReason) return;
    setError(null);
    if (singleId) {
      closeFinding.mutate(
        { id: singleId, reasonCode: selectedReason.code, note },
        {
          onSuccess: () => {
            resetAndClose();
            window.alert("Находка закрыта");
          },
          onError: (e) => setError(e instanceof Error ? e.message : "Не удалось закрыть находку"),
        },
      );
      return;
    }
    bulkClose.mutate(
      { ids: findingIds, reasonCode: selectedReason.code, note },
      {
        onSuccess: () => {
          resetAndClose();
          window.alert(`Закрыто находок: ${findingIds.length}`);
        },
        onError: (e) => setError(e instanceof Error ? e.message : "Не удалось закрыть находки"),
      },
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && resetAndClose()}>
      <DialogContent className="max-w-lg border-zinc-800 bg-zinc-900 text-zinc-100">
        <DialogHeader>
          <DialogTitle>{singleId ? "Закрыть находку" : `Закрыть ${findingIds.length} находок`}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs text-zinc-400">Причина</label>
            <select
              value={reasonCode}
              onChange={(e) => setReasonCode(e.target.value)}
              className="h-9 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-100"
            >
              <option value="">Выберите причину</option>
              {reasons.map((reason) => (
                <option key={reason.code} value={reason.code} disabled={!reason.is_active}>
                  {reason.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-zinc-400">
              {noteRequired ? "Обязательный комментарий " : "Комментарий"}
              {noteRequired ? <span className="text-red-500">*</span> : null}
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={4}
              className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
            />
          </div>

          {error ? <div className="rounded-md border border-red-700/40 bg-red-950/40 p-2 text-sm text-red-300">{error}</div> : null}
        </div>

        <DialogFooter className="mt-2 border-zinc-800 bg-zinc-900">
          <Button variant="outline" onClick={resetAndClose} disabled={pending}>
            Отмена
          </Button>
          <Button onClick={onSubmit} disabled={!canSubmit || pending}>
            Закрыть
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
