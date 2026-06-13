import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Props {
  open: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  /** If provided, user must type this value to enable confirmation */
  requireMatch?: string;
  /** Minimum chars for reason textarea */
  minReason?: number;
  loading?: boolean;
}

export function ConfirmDestructiveActionModal({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Подтвердить",
  requireMatch,
  minReason = 10,
  loading = false,
}: Props) {
  const [reason, setReason] = useState("");
  const [matchValue, setMatchValue] = useState("");

  const reasonOk = reason.trim().length >= minReason;
  const matchOk = !requireMatch || matchValue.trim() === requireMatch;
  const canConfirm = reasonOk && matchOk && !loading;

  function handleClose() {
    setReason("");
    setMatchValue("");
    onClose();
  }

  function handleConfirm() {
    if (!canConfirm) return;
    onConfirm(reason.trim());
    setReason("");
    setMatchValue("");
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-md" onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle className="text-base">{title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <p className="text-sm text-muted-foreground">{description}</p>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground/70">
              Причина <span className="text-destructive">*</span>
            </label>
            <textarea
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-[2px] focus-visible:ring-ring/50 min-h-[72px]"
              placeholder={`Не менее ${minReason} символов…`}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={loading}
            />
            {reason.length > 0 && reason.trim().length < minReason && (
              <p className="text-xs text-destructive">
                Ещё {minReason - reason.trim().length} символов
              </p>
            )}
          </div>

          {requireMatch && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground/70">
                Введите <code className="text-xs bg-muted px-1 py-0.5 rounded">{requireMatch}</code> для подтверждения
              </label>
              <Input
                value={matchValue}
                onChange={(e) => setMatchValue(e.target.value)}
                placeholder={requireMatch}
                disabled={loading}
                className="font-mono text-sm"
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            Отмена
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={!canConfirm}
          >
            {loading ? "Выполняется…" : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
