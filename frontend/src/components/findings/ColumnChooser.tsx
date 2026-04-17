import { useEffect, useMemo, useState } from "react";

import {
  COLUMN_LABEL,
  type ColumnKey,
  type FindingsTabKey,
  REQUIRED_COLUMNS,
  availableColumnsForTab,
} from "@/components/findings/findingsTableConfig";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface ColumnChooserProps {
  tab: FindingsTabKey;
  open: boolean;
  value: ColumnKey[];
  onApply: (columns: ColumnKey[]) => void;
  onCancel: () => void;
  onResetPreset: () => void;
}

export default function ColumnChooser({
  tab,
  open,
  value,
  onApply,
  onCancel,
  onResetPreset,
}: ColumnChooserProps) {
  const [draft, setDraft] = useState<ColumnKey[]>(value);

  useEffect(() => {
    if (open) setDraft(value);
  }, [open, value]);

  const requiredSet = useMemo(() => new Set(REQUIRED_COLUMNS), []);
  const available = useMemo(() => availableColumnsForTab(tab), [tab]);

  const toggle = (key: ColumnKey, checked: boolean) => {
    if (requiredSet.has(key)) return;
    setDraft((prev) => {
      if (checked) {
        return prev.includes(key) ? prev : [...prev, key];
      }
      return prev.filter((item) => item !== key);
    });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onCancel()}>
      <DialogContent className="max-w-xl border-zinc-800 bg-zinc-900 text-zinc-100">
        <DialogHeader>
          <DialogTitle>Настроить колонки</DialogTitle>
        </DialogHeader>

        <div className="space-y-2">
          {available.map((key) => {
            const checked = draft.includes(key) || requiredSet.has(key);
            const disabled = requiredSet.has(key);
            return (
              <div
                key={key}
                draggable={!disabled}
                onDragStart={(e) => e.dataTransfer.setData("text/plain", key)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const dragged = e.dataTransfer.getData("text/plain") as ColumnKey;
                  if (!dragged || dragged === key || disabled || requiredSet.has(dragged)) return;
                  setDraft((prev) => {
                    const next = prev.filter((item) => item !== dragged);
                    const idx = next.indexOf(key);
                    if (idx < 0) return prev;
                    next.splice(idx, 0, dragged);
                    return next;
                  });
                }}
                className="flex items-center gap-2 rounded border border-zinc-800 bg-zinc-950/40 px-3 py-2"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={disabled}
                  onChange={(e) => toggle(key, e.target.checked)}
                  className="size-3.5 rounded border-zinc-600 bg-zinc-900 accent-red-600"
                />
                <span className="text-sm text-zinc-200">{COLUMN_LABEL[key]}</span>
                {disabled && <span className="ml-auto text-xs text-zinc-500">обязательно</span>}
              </div>
            );
          })}
        </div>

        <div className="mt-2 flex items-center justify-end gap-2">
          <Button variant="ghost" onClick={onCancel}>Отмена</Button>
          <Button variant="outline" onClick={onResetPreset}>Сбросить к пресету</Button>
          <Button
            onClick={() => {
              const ordered = [
                ...REQUIRED_COLUMNS,
                ...draft.filter((key) => !requiredSet.has(key)),
              ].filter((key, idx, arr) => arr.indexOf(key) === idx);
              onApply(ordered);
            }}
          >
            Применить
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
