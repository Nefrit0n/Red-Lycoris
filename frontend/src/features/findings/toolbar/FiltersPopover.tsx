import {
  Badge,
  Box,
  Button,
  ClickAwayListener,
  Divider,
  FormControlLabel,
  Grow,
  IconButton,
  Paper,
  Popper,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import BoltIcon from "@mui/icons-material/Bolt";
import FilterAltOutlinedIcon from "@mui/icons-material/FilterAltOutlined";
import StarRoundedIcon from "@mui/icons-material/StarRounded";
import { useEffect, useMemo, useRef, useState } from "react";
import { FiltersState, DEFAULT_FILTERS_STATE } from "../../filters/types";
import { DATE_PRESET_OPTIONS, LANGUAGE_OPTIONS } from "../../filters/labels";
import { primitives } from "../../../design-system/tokens/colors";
import { useProductOptions, useScannerOptions } from "./hooks";
import PillDropdownMulti, {
  PillDropdownOption,
} from "../../../components/filters/PillDropdownMulti";
import { FindingSeverity, FindingStatus } from "../../../types/findings";
import { useSavedViews } from "../../../hooks/useSavedViews";

interface OptionItem {
  value: string;
  label: string;
}

const SEVERITY_LABELS_RU: Record<FindingSeverity, string> = {
  low: "Низкая",
  medium: "Средняя",
  high: "Высокая",
  critical: "Критическая",
};

const STATUS_LABELS_RU: Record<FindingStatus, string> = {
  new: "Новый",
  under_review: "На проверке",
  confirmed: "Подтверждено",
  false_positive: "Ложноположительное",
  out_of_scope: "Вне области",
  risk_accepted: "Риск принят",
  mitigated: "Исправлено",
  duplicate: "Дубликат",
};

const severityOptions: PillDropdownOption[] = (Object.keys(SEVERITY_LABELS_RU) as FindingSeverity[])
  .map((value) => ({
    id: value,
    label: SEVERITY_LABELS_RU[value],
  }));

const statusOptions: PillDropdownOption[] = (Object.keys(STATUS_LABELS_RU) as FindingStatus[])
  .map((value) => ({
    id: value,
    label: STATUS_LABELS_RU[value],
  }));

interface FiltersPopoverProps {
  filters: FiltersState;
  onApply: (next: FiltersState) => void;
  onClear: (next: FiltersState) => void;
  activeCount: number;
  debouncedSearch?: string;
  scannerOptionsOverride?: OptionItem[];
  productOptionsOverride?: OptionItem[];
  scannersLoadingOverride?: boolean;
  productsLoadingOverride?: boolean;
}

const FiltersPopover = ({
  filters,
  onApply,
  onClear,
  activeCount,
  debouncedSearch,
  scannerOptionsOverride,
  productOptionsOverride,
  scannersLoadingOverride,
  productsLoadingOverride,
}: FiltersPopoverProps) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [draft, setDraft] = useState<FiltersState>(filters);
  const [showCustomDates, setShowCustomDates] = useState(false);
  const [openMenu, setOpenMenu] = useState<
    null | "sev" | "status" | "tools" | "products" | "languages"
  >(null);
  const open = Boolean(anchorEl);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  const scannersHook = useScannerOptions(filters, debouncedSearch);
  const productsHook = useProductOptions();
  const scannerOptionsRaw = scannerOptionsOverride ?? scannersHook.options;
  const productOptionsRaw = productOptionsOverride ?? productsHook.options;
  const scannersLoading = scannersLoadingOverride ?? scannersHook.loading;
  const productsLoading = productsLoadingOverride ?? productsHook.loading;

  useEffect(() => {
    if (open) {
      setDraft(filters);
      setShowCustomDates(Boolean(filters.dateFrom || filters.dateTo));
    }
  }, [filters, open]);

  useEffect(() => {
    if (!open) {
      setOpenMenu(null);
    }
  }, [open]);

  const scannerOptions = useMemo(
    () =>
      scannerOptionsRaw.map((option) => ({
        id: option.value,
        label: option.label,
      })),
    [scannerOptionsRaw]
  );

  const productOptions = useMemo(
    () =>
      productOptionsRaw.map((option) => ({
        id: option.value,
        label: option.label,
      })),
    [productOptionsRaw]
  );

  const productLabelMap = useMemo(() => {
    const map = new Map<string, string>();
    productOptions.forEach((option) => map.set(option.id, option.label));
    return map;
  }, [productOptions]);

  const scannerLabelMap = useMemo(() => {
    const map = new Map<string, string>();
    scannerOptions.forEach((option) => map.set(option.id, option.label));
    return map;
  }, [scannerOptions]);

  const severityLabelMap = useMemo(() => {
    const map = new Map<string, string>();
    severityOptions.forEach((option) => map.set(option.id, option.label));
    return map;
  }, []);

  const statusLabelMap = useMemo(() => {
    const map = new Map<string, string>();
    statusOptions.forEach((option) => map.set(option.id, option.label));
    return map;
  }, []);

  const languageOptions = useMemo(
    () =>
      LANGUAGE_OPTIONS.map((option) => ({
        id: option.value,
        label: option.label,
      })),
    []
  );

  const languageLabelMap = useMemo(() => {
    const map = new Map<string, string>();
    languageOptions.forEach((option) => map.set(option.id, option.label));
    return map;
  }, [languageOptions]);

  const { builtInViews } = useSavedViews();

  const applyQuickFilter = (preset: Partial<FiltersState>) => {
    const next = {
      ...DEFAULT_FILTERS_STATE,
      search: filters.search,
      pageSize: filters.pageSize,
      sortField: filters.sortField,
      sortOrder: filters.sortOrder,
      ...preset,
    };
    setDraft(next);
    setShowCustomDates(Boolean(next.dateFrom || next.dateTo));
    onApply(next);
    setAnchorEl(null);
    setOpenMenu(null);
    buttonRef.current?.focus();
  };

  const buildSummary = (values: string[], map: Map<string, string>) => {
    if (values.length === 0) {
      return "Все";
    }
    const labels = values.map((value) => map.get(value) ?? value);
    if (labels.length > 2) {
      return `Выбрано: ${labels.length}`;
    }
    return labels.join(", ");
  };

  return (
    <Box>
      <Badge
        badgeContent={activeCount}
        color="error"
        overlap="circular"
        sx={{
          "& .MuiBadge-badge": {
            bgcolor: primitives.lotus[500],
            color: primitives.night[50],
          },
        }}
      >
        <IconButton
          size="small"
          onClick={(event) => setAnchorEl(event.currentTarget)}
          sx={{
            width: 32,
            height: 32,
            border: `1px solid ${activeCount > 0 ? primitives.lotus[500] : primitives.night[600]}`,
            color: activeCount > 0 ? primitives.lotus[200] : primitives.night[100],
            "&:hover": { borderColor: primitives.lotus[400], color: primitives.lotus[400] },
          }}
          ref={buttonRef}
          aria-label="Открыть фильтры"
        >
          <FilterAltOutlinedIcon sx={{ fontSize: 18 }} />
        </IconButton>
      </Badge>

      <ClickAwayListener
        disableReactTree
        onClickAway={(event) => {
          if (buttonRef.current && buttonRef.current.contains(event.target as Node)) {
            return;
          }
          setAnchorEl(null);
          setOpenMenu(null);
          buttonRef.current?.focus();
        }}
      >
        <Box>
          <Popper
            open={open}
            anchorEl={anchorEl}
            placement="bottom-end"
            strategy="fixed"
            sx={{ zIndex: (theme) => theme.zIndex.modal + 1 }}
            modifiers={[
              { name: "offset", options: { offset: [0, 8] } },
              { name: "flip", options: { padding: 8 } },
              { name: "preventOverflow", options: { boundary: "viewport", padding: 8 } },
            ]}
          >
            <Grow in={open} style={{ transformOrigin: "top right" }}>
              <Paper
                sx={{
                  width: 340,
                  bgcolor: primitives.night[700],
                  color: primitives.night[50],
                  p: 1,
                  border: `1px solid ${primitives.night[600]}`,
                  boxShadow: "0 10px 24px rgba(0,0,0,0.25)",
                  overflow: "visible",
                }}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    event.preventDefault();
                    event.stopPropagation();
                    if (openMenu) {
                      setOpenMenu(null);
                      return;
                    }
                    setAnchorEl(null);
                    setOpenMenu(null);
                    buttonRef.current?.focus();
                  }
                }}
              >
                <Stack spacing={0.75}>
                  <Stack spacing={0.5}>
                    <Typography variant="subtitle2">Быстрые наборы</Typography>
                    <Stack
                      spacing={0.5}
                      sx={{
                        borderRadius: 2,
                        border: `1px solid ${primitives.night[600]}`,
                        bgcolor: primitives.night[750],
                        p: 0.75,
                      }}
                    >
                      {builtInViews.map((item) => (
                        <Button
                          key={item.id}
                          variant="text"
                          onClick={() => applyQuickFilter(item.filters)}
                          startIcon={<StarRoundedIcon sx={{ color: "#FACC15" }} fontSize="small" />}
                          sx={{
                            justifyContent: "flex-start",
                            textTransform: "none",
                            color: primitives.night[50],
                            borderRadius: 1.5,
                            px: 1,
                            py: 0.5,
                            minHeight: 32,
                            fontSize: 13,
                            "&:hover": { bgcolor: primitives.night[600] },
                          }}
                        >
                          {item.name}
                        </Button>
                      ))}
                    </Stack>
                  </Stack>

                  <Divider sx={{ borderColor: primitives.night[600] }} />

                  <Typography variant="subtitle2">Фильтры</Typography>

                  <Box
                    sx={{
                      display: "grid",
                      gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                      gap: 0.75,
                    }}
                  >
                    <PillDropdownMulti
                      label="Критичность"
                      options={severityOptions}
                      selected={draft.severities}
                      onChange={(next) => setDraft((prev) => ({ ...prev, severities: next }))}
                      summary={buildSummary(draft.severities, severityLabelMap)}
                      open={openMenu === "sev"}
                      onToggle={() =>
                        setOpenMenu((prev) => (prev === "sev" ? null : "sev"))
                      }
                      onClose={() => setOpenMenu(null)}
                    />
                    <PillDropdownMulti
                      label="Статус"
                      options={statusOptions}
                      selected={draft.statuses}
                      onChange={(next) => setDraft((prev) => ({ ...prev, statuses: next }))}
                      summary={buildSummary(draft.statuses, statusLabelMap)}
                      open={openMenu === "status"}
                      onToggle={() =>
                        setOpenMenu((prev) => (prev === "status" ? null : "status"))
                      }
                      onClose={() => setOpenMenu(null)}
                    />
                    <PillDropdownMulti
                      label="Инструменты"
                      options={scannerOptions}
                      searchable
                      selected={draft.scannerTypes}
                      onChange={(next) => setDraft((prev) => ({ ...prev, scannerTypes: next }))}
                      summary={
                        scannersLoading
                          ? "Загрузка..."
                          : buildSummary(draft.scannerTypes, scannerLabelMap)
                      }
                      open={openMenu === "tools"}
                      onToggle={() =>
                        setOpenMenu((prev) => (prev === "tools" ? null : "tools"))
                      }
                      onClose={() => setOpenMenu(null)}
                    />
                    <PillDropdownMulti
                      label="Продукты"
                      options={productOptions}
                      searchable
                      selected={draft.productIds}
                      onChange={(next) => setDraft((prev) => ({ ...prev, productIds: next }))}
                      summary={
                        productsLoading
                          ? "Загрузка..."
                          : buildSummary(draft.productIds, productLabelMap)
                      }
                      open={openMenu === "products"}
                      onToggle={() =>
                        setOpenMenu((prev) => (prev === "products" ? null : "products"))
                      }
                      onClose={() => setOpenMenu(null)}
                    />
                    <PillDropdownMulti
                      label="Языки"
                      options={languageOptions}
                      searchable
                      selected={draft.languages}
                      onChange={(next) => setDraft((prev) => ({ ...prev, languages: next }))}
                      summary={buildSummary(draft.languages, languageLabelMap)}
                      open={openMenu === "languages"}
                      onToggle={() =>
                        setOpenMenu((prev) => (prev === "languages" ? null : "languages"))
                      }
                      onClose={() => setOpenMenu(null)}
                    />
                  </Box>

                  <Stack spacing={0.5}>
                    <Box
                      sx={{
                        display: "grid",
                        gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                        gap: 0.75,
                      }}
                    >
                      {DATE_PRESET_OPTIONS.map((preset) => (
                        <Button
                          key={preset.id}
                          size="small"
                          variant={draft.datePreset === preset.id ? "contained" : "outlined"}
                          onClick={() => {
                            setDraft((prev) => ({
                              ...prev,
                              datePreset: preset.id as FiltersState["datePreset"],
                              dateFrom: "",
                              dateTo: "",
                            }));
                            setShowCustomDates(false);
                          }}
                          onFocus={() => setShowCustomDates(false)}
                          onMouseDown={() => setShowCustomDates(false)}
                          sx={{
                            borderRadius: "999px",
                            height: 32,
                            textTransform: "none",
                            fontSize: 12,
                            borderColor: primitives.night[600],
                            color:
                              draft.datePreset === preset.id
                                ? primitives.night[50]
                                : primitives.night[50],
                            bgcolor:
                              draft.datePreset === preset.id
                                ? primitives.lotus[500]
                                : "transparent",
                            "&:hover": {
                              borderColor: primitives.lotus[400],
                              bgcolor:
                                draft.datePreset === preset.id
                                  ? primitives.lotus[400]
                                  : "rgba(225, 29, 72, 0.08)",
                            },
                          }}
                        >
                          {preset.label}
                        </Button>
                      ))}
                      <Button
                        size="small"
                        variant={showCustomDates ? "contained" : "outlined"}
                        onClick={() => {
                          setDraft((prev) => ({ ...prev, datePreset: "" }));
                          setShowCustomDates(true);
                        }}
                        onFocus={() => setShowCustomDates(true)}
                        sx={{
                          borderRadius: "999px",
                          height: 32,
                          textTransform: "none",
                          fontSize: 12,
                          borderColor: primitives.night[600],
                          color: primitives.night[50],
                          bgcolor: showCustomDates ? primitives.lotus[500] : "transparent",
                          "&:hover": {
                            borderColor: primitives.lotus[400],
                            bgcolor: showCustomDates
                              ? primitives.lotus[400]
                              : "rgba(225, 29, 72, 0.08)",
                          },
                        }}
                      >
                        Свои даты
                      </Button>
                    </Box>

                    {showCustomDates && (
                      <Stack direction="row" spacing={1}>
                        <TextField
                          type="date"
                          size="small"
                          label="С"
                          value={draft.dateFrom}
                          onChange={(event) =>
                            setDraft((prev) => ({ ...prev, dateFrom: event.target.value }))
                          }
                          InputLabelProps={{ shrink: true }}
                          sx={{ flex: 1 }}
                        />
                        <TextField
                          type="date"
                          size="small"
                          label="По"
                          value={draft.dateTo}
                          onChange={(event) =>
                            setDraft((prev) => ({ ...prev, dateTo: event.target.value }))
                          }
                          InputLabelProps={{ shrink: true }}
                          sx={{ flex: 1 }}
                        />
                      </Stack>
                    )}
                  </Stack>

                  <FormControlLabel
                    sx={{ m: 0, alignItems: "center" }}
                    control={
                      <Switch
                        size="small"
                        checked={draft.showRepeats}
                        onChange={(event) =>
                          setDraft((prev) => ({ ...prev, showRepeats: event.target.checked }))
                        }
                      />
                    }
                    label={
                      <Typography variant="body2" sx={{ color: primitives.night[100] }}>
                        Показывать повторы
                      </Typography>
                    }
                  />

                  <Stack direction="row" justifyContent="flex-end" spacing={1}>
                    {activeCount > 0 && (
                      <Button
                        variant="text"
                        size="small"
                        onClick={() => {
                          const cleared = { ...DEFAULT_FILTERS_STATE, search: filters.search };
                          setDraft(cleared);
                          setShowCustomDates(false);
                          onClear(cleared);
                        }}
                        sx={{ color: primitives.night[200] }}
                      >
                        Очистить
                      </Button>
                    )}
                    <Button
                      variant="contained"
                      size="small"
                      onClick={() => {
                        onApply(draft);
                        setAnchorEl(null);
                        setOpenMenu(null);
                        buttonRef.current?.focus();
                      }}
                    >
                      Готово
                    </Button>
                  </Stack>
                </Stack>
              </Paper>
            </Grow>
          </Popper>
        </Box>
      </ClickAwayListener>
    </Box>
  );
};

export default FiltersPopover;
