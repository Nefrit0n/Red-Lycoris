import {
  Badge,
  Box,
  Button,
  Checkbox,
  ClickAwayListener,
  FormControlLabel,
  Grow,
  IconButton,
  Menu,
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
  const [showCustomDates, setShowCustomDates] = useState(false);
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
      setShowCustomDates(Boolean(filters.dateFrom || filters.dateTo));
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
            height: 36,
            fontSize: 12,
            px: 1.5,
            color: primitives.night[50],
            borderColor: primitives.night[600],
            justifyContent: "space-between",
            "&:hover": {
              borderColor: primitives.lotus[400],
              bgcolor: "rgba(225, 29, 72, 0.08)",
            },
          }}
          aria-label={label}
          fullWidth
        >
          {label}: {summary}
        </Button>

        <Menu
          open={openMenu}
          anchorEl={anchor}
          onClose={handleClose}
          MenuListProps={{ dense: true, disablePadding: true }}
          anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
          transformOrigin={{ vertical: "top", horizontal: "left" }}
          slotProps={{
            paper: {
              sx: {
                width: 260,
                bgcolor: primitives.night[800],
                color: primitives.night[50],
                p: 1,
                border: `1px solid ${primitives.night[600]}`,
                boxShadow: "0 8px 20px rgba(0,0,0,0.25)",
              },
            },
          }}
        >
          <Stack spacing={1} sx={{ px: 1, pt: 0.5, pb: 0.75 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="caption" sx={{ color: primitives.night[200] }}>
                {label}
              </Typography>
              <Stack direction="row" spacing={1}>
                <Button size="small" variant="text" onClick={handleSelectAll}>
                  Всё
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
                sx={{
                  "& .MuiInputBase-root": {
                    bgcolor: primitives.night[700],
                  },
                }}
              />
            )}
          </Stack>
          <Box sx={{ maxHeight: 220, overflowY: "auto", pb: 0.5 }}>
            {loading ? (
              <Typography variant="caption" sx={{ color: primitives.night[300], px: 2 }}>
                Загрузка...
              </Typography>
            ) : filteredOptions.length ? (
              filteredOptions.map((option) => (
                <MenuItem
                  key={option.value}
                  onClick={() => handleToggle(option.value)}
                  dense
                  sx={{ px: 1.5, py: 0.5, gap: 1 }}
                >
                  <Checkbox checked={selectedSet.has(option.value)} size="small" />
                  <Typography variant="body2">{option.label}</Typography>
                </MenuItem>
              ))
            ) : (
              <Typography variant="caption" sx={{ color: primitives.night[300], px: 2 }}>
                Нет вариантов
              </Typography>
            )}
          </Box>
        </Menu>
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

      <ClickAwayListener
        disableReactTree
        onClickAway={(event) => {
          if (buttonRef.current && buttonRef.current.contains(event.target as Node)) {
            return;
          }
          setAnchorEl(null);
          buttonRef.current?.focus();
        }}
      >
        <Box>
          <Popper
            open={open}
            anchorEl={anchorEl}
            placement="bottom-end"
            modifiers={[{ name: "offset", options: { offset: [0, 8] } }]}
          >
            <Grow in={open} style={{ transformOrigin: "top right" }}>
              <Paper
                sx={{
                  width: 380,
                  bgcolor: primitives.night[700],
                  color: primitives.night[50],
                  p: 1.5,
                  border: `1px solid ${primitives.night[600]}`,
                  boxShadow: "0 10px 24px rgba(0,0,0,0.25)",
                }}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    event.stopPropagation();
                    setAnchorEl(null);
                    buttonRef.current?.focus();
                  }
                }}
              >
                <Stack spacing={1}>
                  <Typography variant="subtitle2">Фильтры</Typography>

                  <Box
                    sx={{
                      display: "grid",
                      gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                      gap: 1,
                    }}
                  >
                    <PillMultiSelect
                      label="Критичность"
                      options={severityOptions}
                      values={draft.severities}
                      onChange={(next) => setDraft((prev) => ({ ...prev, severities: next }))}
                      summary={buildSummary(draft.severities, severityLabelMap)}
                    />
                    <PillMultiSelect
                      label="Статус"
                      options={statusOptions}
                      values={draft.statuses}
                      onChange={(next) => setDraft((prev) => ({ ...prev, statuses: next }))}
                      summary={buildSummary(draft.statuses, statusLabelMap)}
                    />
                    <PillMultiSelect
                      label="Инструменты"
                      options={scannerOptions}
                      values={draft.scannerTypes}
                      loading={scannersLoading}
                      searchable
                      onChange={(next) => setDraft((prev) => ({ ...prev, scannerTypes: next }))}
                      summary={buildSummary(draft.scannerTypes, scannerLabelMap)}
                    />
                    <PillMultiSelect
                      label="Продукты"
                      options={productOptions}
                      values={draft.productIds}
                      loading={productsLoading}
                      searchable
                      onChange={(next) => setDraft((prev) => ({ ...prev, productIds: next }))}
                      summary={buildSummary(draft.productIds, productLabelMap)}
                    />
                  </Box>

                  <Stack spacing={0.75}>
                    <Box
                      sx={{
                        display: "grid",
                        gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                        gap: 1,
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
                            height: 36,
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
                          height: 36,
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
                        Кастом
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
