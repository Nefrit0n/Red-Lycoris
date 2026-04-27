import { useState, useCallback, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FilterPopover } from "./FilterPopover";
import type { UsersFilters } from "@/hooks/admin/useUsersFilters";

const SORT_OPTIONS = [
  { value: "last_login_desc", label: "По последнему входу" },
  { value: "created_at_desc", label: "По дате создания" },
  { value: "email_asc", label: "По email" },
  { value: "name_asc", label: "По ФИО" },
];

const FILTER_LABELS: Partial<Record<keyof UsersFilters, string>> = {
  roles: "Роль",
  statuses: "Статус",
  mfa: "MFA",
  source: "Источник",
  dormant: "Неактивные",
  groupId: "Группа",
};

interface Props {
  filters: UsersFilters;
  setFilter: (key: keyof UsersFilters, value: unknown) => void;
  removeFilter: (key: keyof UsersFilters) => void;
  onCreateUser: () => void;
}

export function UsersToolbar({
  filters,
  setFilter,
  removeFilter,
  onCreateUser,
}: Props) {
  const [filterOpen, setFilterOpen] = useState(false);
  const [localQ, setLocalQ] = useState(filters.q);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Keep localQ in sync if filters.q changes externally (e.g. URL navigation)
  useEffect(() => {
    setLocalQ(filters.q);
  }, [filters.q]);

  const handleSearch = useCallback(
    (value: string) => {
      setLocalQ(value);
      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        setFilter("q", value);
      }, 300);
    },
    [setFilter]
  );

  // Active filter chips
  const chips: { key: keyof UsersFilters; label: string }[] = [];
  if (filters.roles.length > 0) {
    chips.push({
      key: "roles",
      label: `${FILTER_LABELS.roles}: ${filters.roles.join(", ")}`,
    });
  }
  if (filters.statuses.length > 0) {
    chips.push({
      key: "statuses",
      label: `${FILTER_LABELS.statuses}: ${filters.statuses.join(", ")}`,
    });
  }
  if (filters.mfa) {
    chips.push({ key: "mfa", label: `${FILTER_LABELS.mfa}: ${filters.mfa}` });
  }
  if (filters.source) {
    chips.push({
      key: "source",
      label: `${FILTER_LABELS.source}: ${filters.source}`,
    });
  }
  if (filters.dormant) {
    chips.push({ key: "dormant", label: FILTER_LABELS.dormant! });
  }
  if (filters.groupId) {
    chips.push({ key: "groupId", label: `${FILTER_LABELS.groupId}: …` });
  }

  function handleApplyFilter(field: string, value: unknown) {
    if (field === "role") setFilter("roles", value);
    else if (field === "status") setFilter("statuses", value);
    else if (field === "mfa") setFilter("mfa", value);
    else if (field === "source") setFilter("source", value);
    else if (field === "dormant") setFilter("dormant", value);
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Row 1: search, filter button, sort, create */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <svg
            className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <Input
            className="pl-8 h-8 text-sm"
            placeholder="Поиск по email или ФИО…"
            value={localQ}
            onChange={(e) => handleSearch(e.target.value)}
          />
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => setFilterOpen(true)}
          className="h-8 gap-1.5"
        >
          <span className="text-base leading-none">+</span>
          Фильтр
        </Button>

        <Select
          value={filters.sort || "last_login_desc"}
          onValueChange={(v) => setFilter("sort", v)}
        >
          <SelectTrigger className="h-8 w-[180px] text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="ml-auto">
          <Button size="sm" onClick={onCreateUser} className="h-8">
            + Создать пользователя
          </Button>
        </div>
      </div>

      {/* Row 2: active filter chips */}
      {chips.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {chips.map((chip) => (
            <span
              key={chip.key}
              className="inline-flex items-center gap-1 rounded-full bg-accent text-accent-foreground px-2.5 py-0.5 text-xs"
            >
              {chip.label}
              <button
                type="button"
                className="ml-0.5 rounded-full hover:text-foreground transition-colors"
                onClick={() => removeFilter(chip.key)}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      <FilterPopover
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        filters={filters}
        onApply={handleApplyFilter}
      />
    </div>
  );
}
