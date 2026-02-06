import {
  Badge,
  Box,
  Button,
  Checkbox,
  ClickAwayListener,
  Divider,
  FormControlLabel,
  Grow,
  IconButton,
  MenuItem,
  Paper,
  Popper,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import FilterAltOutlinedIcon from "@mui/icons-material/FilterAltOutlined";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import { useEffect, useMemo, useRef, useState } from "react";
import { FiltersState, DEFAULT_FILTERS_STATE } from "../../filters/types";
import { DATE_PRESET_OPTIONS } from "../../filters/labels";
import { SEVERITY_STYLES, STATUS_LABELS } from "../../../utils/findingConstants";
import { primitives } from "../../../design-system/tokens/colors";
import { useProductOptions, useScannerOptions } from "./hooks";

interface OptionItem {
  value: string;
  label: string;
}

const severityOptions: OptionItem[] = Object.entries(SEVERITY_STYLES).map(([value, meta]) => ({
  value,
  label: meta.label,
}));

const statusOptions: OptionItem[] = Object.entries(STATUS_LABELS).map(([value, label]) => ({
  value,
  label,
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
  const open = Boolean(anchorEl);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  const scannersHook = useScannerOptions(filters, debouncedSearch);
  const productsHook = useProductOptions();
  const scannerOptions = scannerOptionsOverride ?? scannersHook.options;
  const productOptions = productOptionsOverride ?? productsHook.options;
  const scannersLoading = scannersLoadingOverride ?? scannersHook.loading;
  const productsLoading = productsLoadingOverride ?? productsHook.loading;

  useEffect(() => {
    if (open) {
      setDraft(filters);
    }
  }, [filters, open]);

  const productLabelMap = useMemo(() => {
    const map = new Map<string, string>();
    productOptions.forEach((option) => map.set(option.value, option.label));
    return map;
  }, [productOptions]);

  const scannerLabelMap = useMemo(() => {
    const map = new Map<string, string>();
    scannerOptions.forEach((option) => map.set(option.value, option.label));
    return map;
  }, [scannerOptions]);

  const severityLabelMap = useMemo(() => {
    const map = new Map<string, string>();
    severityOptions.forEach((option) => map.set(option.value, option.label));
    return map;
  }, []);

  const statusLabelMap = useMemo(() => {
    const map = new Map<string, string>();
    statusOptions.forEach((option) => map.set(option.value, option.label));
    return map;
  }, []);

  const buildSummary = (label: string, values: string[], map: Map<string, string>) => {
    if (values.length === 0) {
      return `${label}: Все`;
    }
    const labels = values.map((value) => map.get(value) ?? value);
    const visible = labels.slice(0, 2).join(", ");
    const extra = labels.length - 2;
    return `${label}: ${visible}${extra > 0 ? ` +${extra}` : ""}`;
  };

  const PillMultiSelect = ({
    label,
    options,
    values,
    loading,
    searchable = false,
    onChange,
    summary,
  }: {
    label: string;
    options: OptionItem[];
    values: string[];
    loading?: boolean;
    searchable?: boolean;
    summary: string;
    onChange: (next: string[]) => void;
  }) => {
    const [anchor, setAnchor] = useState<null | HTMLElement>(null);
    const [query, setQuery] = useState("");
    const openMenu = Boolean(anchor);

    const selectedSet = useMemo(() => new Set(values), [values]);
    const filteredOptions = useMemo(() => {
      if (!query) return options;
      return options.filter((option) =>
        option.label.toLowerCase().includes(query.toLowerCase())
      );
    }, [options, query]);

    const handleToggle = (value: string) => {
      if (selectedSet.has(value)) {
        onChange(values.filter((item) => item !== value));
      } else {
        onChange([...values, value]);
      }
    };

    const handleClose = () => {
      anchor?.focus();
      setAnchor(null);
      setQuery("");
    };

    const handleSelectAll = () => {
      onChange(options.map((option) => option.value));
    };

    const handleClear = () => {
      onChange([]);
    };

    return (
      <Box>
        <Button
          size="small"
          variant="outlined"
          endIcon={<KeyboardArrowDownIcon fontSize="small" />}
          onClick={(event) => setAnchor(event.currentTarget)}
          sx={{
            borderRadius: "999px",
            textTransform: "none",
            height: 32,
            fontSize: 12,
            px: 1.5,
            color: primitives.night[50],
            borderColor: primitives.night[600],
            "&:hover": {
              borderColor: primitives.lotus[400],
              bgcolor: "rgba(225, 29, 72, 0.08)",
            },
          }}
          aria-label={label}
        >
          {summary}
        </Button>

        <Popper
          open={openMenu}
          anchorEl={anchor}
          placement="bottom-start"
          modifiers={[{ name: "offset", options: { offset: [0, 6] } }]}
        >
          <ClickAwayListener
            onClickAway={(event) => {
              if (anchor && anchor.contains(event.target as Node)) {
                return;
              }
              handleClose();
            }}
          >
            <Paper
              sx={{
                width: 260,
                bgcolor: primitives.night[800],
                color: primitives.night[50],
                p: 1.5,
                border: `1px solid ${primitives.night[600]}`,
              }}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.stopPropagation();
                  handleClose();
                }
              }}
            >
              <Stack spacing={1}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="caption" sx={{ color: primitives.night[200] }}>
                    {label}
                  </Typography>
                  <Stack direction="row" spacing={1}>
                    <Button size="small" variant="text" onClick={handleSelectAll}>
                      Выбрать всё
                    </Button>
                    <Button size="small" variant="text" onClick={handleClear}>
                      Очистить
                    </Button>
                  </Stack>
                </Stack>
                {searchable && (
                  <TextField
                    size="small"
                    placeholder="Поиск"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                  />
                )}
                <Box sx={{ maxHeight: 220, overflowY: "auto" }}>
                  {loading ? (
                    <Typography variant="caption" sx={{ color: primitives.night[300] }}>
                      Загрузка...
                    </Typography>
                  ) : filteredOptions.length ? (
                    filteredOptions.map((option) => (
                      <Box
                        key={option.value}
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          gap: 1,
                          px: 0.5,
                          py: 0.5,
                          borderRadius: 1,
                          cursor: "pointer",
                          "&:hover": { bgcolor: "rgba(255,255,255,0.06)" },
                        }}
                        onClick={() => handleToggle(option.value)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            handleToggle(option.value);
                          }
                        }}
                      >
                        <Checkbox checked={selectedSet.has(option.value)} size="small" />
                        <Typography variant="body2">{option.label}</Typography>
                      </Box>
                    ))
                  ) : (
                    <Typography variant="caption" sx={{ color: primitives.night[300] }}>
                      Нет вариантов
                    </Typography>
                  )}
                </Box>
              </Stack>
            </Paper>
          </ClickAwayListener>
        </Popper>
      </Box>
    );
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

      <Popper
        open={open}
        anchorEl={anchorEl}
        placement="bottom-end"
        modifiers={[{ name: "offset", options: { offset: [0, 8] } }]}
      >
        <Grow in={open} style={{ transformOrigin: "top right" }}>
          <Paper
            sx={{
              width: 400,
              bgcolor: primitives.night[700],
              color: primitives.night[50],
              p: 2,
            }}
          >
            <ClickAwayListener
              onClickAway={(event) => {
                if (buttonRef.current && buttonRef.current.contains(event.target as Node)) {
                  return;
                }
                setAnchorEl(null);
                buttonRef.current?.focus();
              }}
            >
              <Stack
                spacing={2}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    event.stopPropagation();
                    setAnchorEl(null);
                    buttonRef.current?.focus();
                  }
                }}
              >
                <Typography variant="subtitle2">Фильтры</Typography>

                <Stack direction="row" spacing={1} flexWrap="wrap">
                  <PillMultiSelect
                    label="Критичность"
                    options={severityOptions}
                    values={draft.severities}
                    onChange={(next) => setDraft((prev) => ({ ...prev, severities: next }))}
                    summary={buildSummary("Критичность", draft.severities, severityLabelMap)}
                  />

                  <PillMultiSelect
                    label="Статус"
                    options={statusOptions}
                    values={draft.statuses}
                    onChange={(next) => setDraft((prev) => ({ ...prev, statuses: next }))}
                    summary={buildSummary("Статус", draft.statuses, statusLabelMap)}
                  />

                  <PillMultiSelect
                    label="Инструменты"
                    options={scannerOptions}
                    values={draft.scannerTypes}
                    loading={scannersLoading}
                    searchable
                    onChange={(next) => setDraft((prev) => ({ ...prev, scannerTypes: next }))}
                    summary={buildSummary("Инструменты", draft.scannerTypes, scannerLabelMap)}
                  />

                  <PillMultiSelect
                    label="Продукты"
                    options={productOptions}
                    values={draft.productIds}
                    loading={productsLoading}
                    searchable
                    onChange={(next) => setDraft((prev) => ({ ...prev, productIds: next }))}
                    summary={buildSummary("Продукты", draft.productIds, productLabelMap)}
                  />
                </Stack>

                <Stack direction="row" spacing={1}>
                  <TextField
                    select
                    label="Период"
                    size="small"
                    value={draft.datePreset}
                    onChange={(event) =>
                      setDraft((prev) => ({
                        ...prev,
                        datePreset: event.target.value as FiltersState["datePreset"],
                      }))
                    }
                    sx={{ flex: 1 }}
                  >
                    <MenuItem value="">Без пресета</MenuItem>
                    {DATE_PRESET_OPTIONS.map((preset) => (
                      <MenuItem key={preset.id} value={preset.id}>
                        {preset.label}
                      </MenuItem>
                    ))}
                  </TextField>
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

                <FormControlLabel
                  control={
                    <Switch
                      checked={draft.showRepeats}
                      onChange={(event) =>
                        setDraft((prev) => ({ ...prev, showRepeats: event.target.checked }))
                      }
                    />
                  }
                  label="Показывать повторы"
                />

                <Divider sx={{ borderColor: primitives.night[600] }} />

                <Stack direction="row" justifyContent="space-between">
                  {activeCount > 0 && (
                    <Button
                      variant="text"
                      onClick={() => {
                        const cleared = { ...DEFAULT_FILTERS_STATE, search: filters.search };
                        setDraft(cleared);
                        onClear(cleared);
                      }}
                      sx={{ color: primitives.night[200] }}
                    >
                      Очистить всё
                    </Button>
                  )}
                  <Button
                    variant="contained"
                    onClick={() => {
                      onApply(draft);
                      setAnchorEl(null);
                      buttonRef.current?.focus();
                    }}
                  >
                    Готово
                  </Button>
                </Stack>
              </Stack>
            </ClickAwayListener>
          </Paper>
        </Grow>
      </Popper>
    </Box>
  );
};

export default FiltersPopover;
