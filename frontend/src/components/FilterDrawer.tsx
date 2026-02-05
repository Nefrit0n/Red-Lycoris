import { Box, Button, Drawer, Stack, Typography, alpha } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { focusRing } from "../design-system/tokens";
import { primitives } from "../design-system/tokens/colors";
import {
  FindingCategory,
  FindingOccurrenceStatus,
  FindingSeverity,
  FindingStatus,
  PolicyDecision,
  RiskBand,
} from "../types/findings";
import { DatePreset } from "../types/filters";
import AdvancedFiltersPanel from "./AdvancedFiltersPanel";

export interface DraftFiltersState {
  productIds: string[];
  search: string;
  severities: FindingSeverity[];
  statuses: FindingStatus[];
  riskBands: RiskBand[];
  occurrences: FindingOccurrenceStatus[];
  scannerTypes: string[];
  policyDecisions: PolicyDecision[];
  categories: FindingCategory[];
  datePreset: DatePreset;
  dateFrom: string;
  dateTo: string;
  showRepeats: boolean;
}

interface FilterDrawerProps {
  open: boolean;
  onClose: () => void;
  onReset: () => void;
  onApply: () => void;
  draftFilters: DraftFiltersState;
  setDraftFilters: (value: DraftFiltersState | ((prev: DraftFiltersState) => DraftFiltersState)) => void;
  severityCounts?: Record<string, number>;
  statusCounts?: Record<string, number>;
  activeCount: number;
}

const FilterDrawer = ({
  open,
  onClose,
  onReset,
  onApply,
  draftFilters,
  setDraftFilters,
  severityCounts,
  statusCounts,
  activeCount,
}: FilterDrawerProps) => {
  return (
    <>
      <Drawer
        anchor="right"
        open={open}
        onClose={onClose}
        PaperProps={{
          sx: {
            width: { xs: "100vw", md: 460 },
            maxWidth: "100vw",
            borderTopLeftRadius: { md: 18, xs: 0 },
            borderBottomLeftRadius: { md: 18, xs: 0 },
            display: "flex",
            flexDirection: "column",
            bgcolor: primitives.night[800],
            borderLeft: `1px solid ${alpha(primitives.night[600], 0.7)}`,
          },
        }}
      >
        <Box
          sx={{
            p: 2,
            position: "sticky",
            top: 0,
            zIndex: 2,
            borderBottom: `1px solid ${alpha(primitives.night[600], 0.7)}`,
            bgcolor: alpha(primitives.night[800], 0.92),
            backdropFilter: "blur(10px)",
          }}
        >
          <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                Фильтры
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Активно: {activeCount}
              </Typography>
            </Box>
            <Stack direction="row" gap={1} alignItems="center">
              <Button
                variant="text"
                size="small"
                onClick={onReset}
                sx={{ textTransform: "none", color: primitives.night[200] }}
              >
                Сбросить
              </Button>
              <IconButton onClick={onClose} aria-label="Закрыть">
                <CloseIcon />
              </IconButton>
            </Stack>
          </Stack>
        </Box>

        <Box sx={{ p: 2, flex: "1 1 auto", overflowY: "auto" }}>
          <AdvancedFiltersPanel
            draftFilters={draftFilters}
            setDraftFilters={setDraftFilters}
            severityCounts={severityCounts}
            statusCounts={statusCounts}
          />
        </Box>

        <Box
          sx={{
            p: 2,
            position: "sticky",
            bottom: 0,
            zIndex: 2,
            borderTop: `1px solid ${alpha(primitives.night[600], 0.7)}`,
            bgcolor: alpha(primitives.night[800], 0.95),
            backdropFilter: "blur(10px)",
          }}
        >
          <Stack direction="row" spacing={1} justifyContent="flex-end">
            <Button variant="text" size="small" onClick={onClose} sx={{ textTransform: "none" }}>
              Отмена
            </Button>
            <Button
              variant="contained"
              size="small"
              onClick={onApply}
              sx={{
                bgcolor: primitives.lotus[500],
                "&:hover": { bgcolor: primitives.lotus[600] },
                boxShadow: focusRing.subtle,
              }}
            >
              Применить
            </Button>
          </Stack>
        </Box>
      </Drawer>
    </>
  );
};

export default FilterDrawer;
