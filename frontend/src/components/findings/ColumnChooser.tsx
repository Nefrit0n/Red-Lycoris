import { useEffect, useMemo, useState } from "react";

import {
  COLUMN_LABEL,
  COLUMN_WIDTH_PX,
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
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);

  useEffect(() => {
    if (open) setDraft(value);
  }, [open, value]);

  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const requiredSet = useMemo(() => new Set(REQUIRED_COLUMNS), []);
  const available = useMemo(() => availableColumnsForTab(tab), [tab]);

  const orderedColumns = useMemo(
    () => [
      ...REQUIRED_COLUMNS,
      ...draft.filter((key) => !requiredSet.has(key)),
    ].filter((key, idx, arr) => arr.indexOf(key) === idx),
    [draft, requiredSet],
  );

  const usedWidth = useMemo(
    () => orderedColumns.reduce((sum, key) => sum + COLUMN_WIDTH_PX[key], 0),
    [orderedColumns],
  );
  const availableWidth = Math.max(320, viewportWidth - 48);
  const overflowPx = Math.max(0, usedWidth - availableWidth);
  const progress = Math.min(100, Math.round((usedWidth / availableWidth) * 100));

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
      <DialogContent className="flex h-[min(86vh,760px)] w-[min(92vw,560px)] max-w-none flex-col border-zinc-800 bg-zinc-900 text-zinc-100">
        <DialogHeader>
          <DialogTitle>Настроить колонки</DialogTitle>
        </DialogHeader>

        <div className="space-y-2 overflow-y-auto pr-1">
          <div className="rounded border border-zinc-800 bg-zinc-950/50 p-2">
            <div className="mb-1.5 flex items-center justify-between text-xs text-zinc-400">
              <span>Ширина колонок</span>
              <span>{usedWidth} / {availableWidth} px</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded bg-zinc-800">
              <div
                className={overflowPx > 0 ? "h-full bg-amber-500" : "h-full bg-emerald-500"}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

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
                <span className="ml-auto text-xs text-zinc-500">{COLUMN_WIDTH_PX[key]}px</span>
                {disabled && <span className="text-xs text-zinc-500">обязательно</span>}
              </div>
            );
          })}
        </div>

        {overflowPx > 0 && (
          <div className="rounded border border-amber-700/60 bg-amber-950/30 px-3 py-2 text-xs text-amber-200">
            ⚠ Выбранные колонки превысят ширину экрана на {overflowPx}px — будет горизонтальный скролл. Рекомендуется использовать пресет Triage или отключить часть колонок.
          </div>
        )}

        <div className="mt-2 flex items-center justify-end gap-2 border-t border-zinc-800 pt-3">
          <Button variant="ghost" onClick={onCancel}>Отмена</Button>
          <Button variant="outline" onClick={onResetPreset}>Сбросить к пресету</Button>
          <Button onClick={() => onApply(orderedColumns)}>
            Применить
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
