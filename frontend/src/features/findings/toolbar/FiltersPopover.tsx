import {
  Autocomplete,
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
  scannerOptionsOverride,
  productOptionsOverride,
  scannersLoadingOverride,
  productsLoadingOverride,
}: FiltersPopoverProps) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [draft, setDraft] = useState<FiltersState>(filters);
  const open = Boolean(anchorEl);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  const scannersHook = useScannerOptions();
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

  const productSelections = useMemo(
    () => productOptions.filter((option) => draft.productIds.includes(option.value)),
    [draft.productIds, productOptions]
  );

  const scannerSelections = useMemo(
    () => scannerOptions.filter((option) => draft.scannerTypes.includes(option.value)),
    [draft.scannerTypes, scannerOptions]
  );

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

                <Autocomplete
                  multiple
                  disableCloseOnSelect
                  filterSelectedOptions
                  options={severityOptions}
                  value={severityOptions.filter((option) => draft.severities.includes(option.value))}
                  onChange={(_, value) =>
                    setDraft((prev) => ({ ...prev, severities: value.map((item) => item.value) }))
                  }
                  getOptionLabel={(option) => option.label}
                  renderOption={(props, option, { selected }) => (
                    <li {...props}>
                      <Checkbox checked={selected} size="small" />
                      {option.label}
                    </li>
                  )}
                  renderInput={(params) => (
                    <TextField {...params} label="Критичность" size="small" />
                  )}
                  limitTags={2}
                />

                <Autocomplete
                  multiple
                  disableCloseOnSelect
                  filterSelectedOptions
                  options={statusOptions}
                  value={statusOptions.filter((option) => draft.statuses.includes(option.value))}
                  onChange={(_, value) =>
                    setDraft((prev) => ({ ...prev, statuses: value.map((item) => item.value) }))
                  }
                  getOptionLabel={(option) => option.label}
                  renderOption={(props, option, { selected }) => (
                    <li {...props}>
                      <Checkbox checked={selected} size="small" />
                      {option.label}
                    </li>
                  )}
                  renderInput={(params) => (
                    <TextField {...params} label="Статус" size="small" />
                  )}
                  limitTags={2}
                />

                <Autocomplete
                  multiple
                  disableCloseOnSelect
                  filterSelectedOptions
                  options={scannerOptions}
                  loading={scannersLoading}
                  value={scannerSelections}
                  onChange={(_, value) =>
                    setDraft((prev) => ({ ...prev, scannerTypes: value.map((item) => item.value) }))
                  }
                  getOptionLabel={(option) => option.label}
                  renderOption={(props, option, { selected }) => (
                    <li {...props}>
                      <Checkbox checked={selected} size="small" />
                      {option.label}
                    </li>
                  )}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Инструменты"
                      size="small"
                      placeholder={scannersLoading ? "Загрузка..." : "Выберите"}
                    />
                  )}
                  noOptionsText="Нет доступных инструментов"
                  limitTags={2}
                />

                <Autocomplete
                  multiple
                  disableCloseOnSelect
                  filterSelectedOptions
                  options={productOptions}
                  loading={productsLoading}
                  value={productSelections}
                  onChange={(_, value) =>
                    setDraft((prev) => ({ ...prev, productIds: value.map((item) => item.value) }))
                  }
                  getOptionLabel={(option) => option.label}
                  renderOption={(props, option, { selected }) => (
                    <li {...props}>
                      <Checkbox checked={selected} size="small" />
                      {option.label}
                    </li>
                  )}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Продукты"
                      size="small"
                      placeholder={productsLoading ? "Загрузка..." : "Выберите"}
                    />
                  )}
                  noOptionsText="Нет доступных продуктов"
                  limitTags={2}
                />

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
