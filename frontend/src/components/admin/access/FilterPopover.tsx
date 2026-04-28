import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { UsersFilters } from "@/hooks/admin/useUsersFilters";

type FilterField =
  | "role"
  | "status"
  | "mfa"
  | "source"
  | "dormant";

interface Props {
  open: boolean;
  onClose: () => void;
  filters: UsersFilters;
  onApply: (field: FilterField, value: unknown) => void;
}

const FIELD_LABELS: Record<FilterField, string> = {
  role: "Роль",
  status: "Статус",
  mfa: "MFA",
  source: "Источник",
  dormant: "Неактивные (>90 дней)",
};

const ROLE_OPTIONS = [
  { value: "admin", label: "Администратор" },
  { value: "auditor", label: "Аудитор" },
  { value: "member", label: "Участник" },
  { value: "viewer", label: "Наблюдатель" },
];

const STATUS_OPTIONS = [
  { value: "active", label: "Активен" },
  { value: "pending", label: "Ожидает" },
  { value: "disabled", label: "Деактивирован" },
];

const MFA_OPTIONS = [
  { value: "enabled", label: "Включена" },
  { value: "disabled", label: "Отключена" },
];

const SOURCE_OPTIONS = [
  { value: "local", label: "Локальный" },
  { value: "ldap", label: "LDAP" },
  { value: "ad", label: "AD" },
  { value: "oidc", label: "OIDC" },
];

export function FilterPopover({ open, onClose, filters, onApply }: Props) {
  const [selectedField, setSelectedField] = useState<FilterField>("role");

  function toggleMulti(
    field: "roles" | "statuses",
    value: string,
    current: string[]
  ) {
    const next = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    onApply(
      field === "roles" ? "role" : "status",
      next
    );
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base">Добавить фильтр</DialogTitle>
        </DialogHeader>

        <div className="flex gap-3">
          {/* Field selector */}
          <nav className="flex flex-col gap-0.5 min-w-[120px]">
            {(Object.keys(FIELD_LABELS) as FilterField[]).map((field) => (
              <button
                key={field}
                type="button"
                onClick={() => setSelectedField(field)}
                className={`rounded px-2.5 py-1.5 text-left text-sm transition-colors ${
                  selectedField === field
                    ? "bg-accent text-accent-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                }`}
              >
                {FIELD_LABELS[field]}
              </button>
            ))}
          </nav>

          <div className="flex-1 space-y-2">
            {selectedField === "role" && (
              <CheckboxGroup
                options={ROLE_OPTIONS}
                selected={filters.roles}
                onChange={(v) => toggleMulti("roles", v, filters.roles)}
              />
            )}
            {selectedField === "status" && (
              <CheckboxGroup
                options={STATUS_OPTIONS}
                selected={filters.statuses}
                onChange={(v) => toggleMulti("statuses", v, filters.statuses)}
              />
            )}
            {selectedField === "mfa" && (
              <RadioGroup
                options={MFA_OPTIONS}
                value={filters.mfa}
                onChange={(v) => onApply("mfa", v)}
              />
            )}
            {selectedField === "source" && (
              <RadioGroup
                options={SOURCE_OPTIONS}
                value={filters.source}
                onChange={(v) => onApply("source", v)}
              />
            )}
            {selectedField === "dormant" && (
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input
                  type="checkbox"
                  checked={filters.dormant}
                  onChange={(e) => onApply("dormant", e.target.checked)}
                  className="rounded"
                />
                Не входил более 90 дней
              </label>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>
            Готово
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CheckboxGroup({
  options,
  selected,
  onChange,
}: {
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      {options.map((opt) => (
        <label key={opt.value} className="flex items-center gap-2 cursor-pointer text-sm">
          <input
            type="checkbox"
            checked={selected.includes(opt.value)}
            onChange={() => onChange(opt.value)}
            className="rounded"
          />
          {opt.label}
        </label>
      ))}
    </div>
  );
}

function RadioGroup({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-2 cursor-pointer text-sm">
        <input
          type="radio"
          checked={!value}
          onChange={() => onChange("")}
        />
        Все
      </label>
      {options.map((opt) => (
        <label key={opt.value} className="flex items-center gap-2 cursor-pointer text-sm">
          <input
            type="radio"
            checked={value === opt.value}
            onChange={() => onChange(opt.value)}
          />
          {opt.label}
        </label>
      ))}
    </div>
  );
}
