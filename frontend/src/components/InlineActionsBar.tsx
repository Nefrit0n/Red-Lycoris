import {
  Box,
  Button,
  Chip,
  FormControl,
  IconButton,
  MenuItem,
  Select,
  Stack,
  TextField,
  Tooltip,
  Typography,
  Collapse,
} from "@mui/material";
import {
  Check as CheckIcon,
  Close as CloseIcon,
  SelectAll as SelectAllIcon,
  CheckBox as CheckBoxIcon,
  CheckBoxOutlineBlank as CheckBoxBlankIcon,
} from "@mui/icons-material";
import { useState } from "react";
import { FindingStatus } from "../types/findings";

type BulkAction = "set_status" | "assign" | "dismiss";

interface InlineActionsBarProps {
  /** Number of selected items on current page */
  selectedCount: number;
  /** Total count of items matching current filters */
  totalCount: number;
  /** Whether total count is known */
  totalKnown: boolean;
  /** Whether "select all matching" mode is active */
  selectAllMatching: boolean;
  /** Whether to show "select all results" prompt (all on page selected but more exist) */
  showSelectAllPrompt: boolean;
  /** Callback to apply bulk action */
  onApply: (action: BulkAction, payload: Record<string, unknown>) => void;
  /** Callback to clear selection */
  onClearSelection: () => void;
  /** Callback to select all matching results */
  onSelectAllResults: () => void;
  /** Whether bulk operation is in progress */
  loading?: boolean;
}

const InlineActionsBar = ({
  selectedCount,
  totalCount,
  totalKnown,
  selectAllMatching,
  showSelectAllPrompt,
  onApply,
  onClearSelection,
  onSelectAllResults,
  loading = false,
}: InlineActionsBarProps) => {
  const [action, setAction] = useState<BulkAction>("set_status");
  const [status, setStatus] = useState<FindingStatus>("under_review");
  const [assigneeId, setAssigneeId] = useState("");

  const effectiveCount = selectAllMatching && totalKnown ? totalCount : selectedCount;
  const isVisible = effectiveCount > 0;

  const handleApply = () => {
    if (action === "set_status" || action === "dismiss") {
      onApply(action, { status });
      return;
    }
    onApply(action, { userId: assigneeId || null });
  };

  return (
    <Collapse in={isVisible}>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1.5,
          px: 2,
          py: 1,
          mb: 2,
          borderRadius: 2,
          bgcolor: "rgba(122, 162, 247, 0.08)",
          border: "1px solid",
          borderColor: "rgba(122, 162, 247, 0.25)",
        }}
      >
        {/* Selection indicator */}
        <Stack direction="row" alignItems="center" spacing={1}>
          <Chip
            icon={selectAllMatching ? <CheckBoxIcon /> : <CheckBoxBlankIcon />}
            label={
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {selectAllMatching && totalKnown
                  ? `Выбрано все: ${totalCount}`
                  : `Выбрано: ${selectedCount}`}
              </Typography>
            }
            size="small"
            color="primary"
            variant="outlined"
            sx={{
              height: 28,
              "& .MuiChip-icon": { fontSize: 16 },
            }}
          />

          {/* Select all prompt */}
          {showSelectAllPrompt && !selectAllMatching && totalKnown && (
            <Button
              size="small"
              variant="text"
              startIcon={<SelectAllIcon />}
              onClick={onSelectAllResults}
              sx={{
                textTransform: "none",
                fontSize: "0.75rem",
                color: "primary.main",
                whiteSpace: "nowrap",
              }}
            >
              Выбрать все {totalCount}
            </Button>
          )}
        </Stack>

        {/* Divider */}
        <Box
          sx={{
            width: 1,
            height: 24,
            bgcolor: "divider",
            mx: 0.5,
          }}
        />

        {/* Action controls */}
        <Stack direction="row" alignItems="center" spacing={1} sx={{ flex: 1 }}>
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <Select
              value={action}
              onChange={(e) => {
                const nextAction = e.target.value as BulkAction;
                setAction(nextAction);
                if (nextAction === "dismiss") {
                  setStatus("false_positive");
                }
              }}
              sx={{ height: 32, fontSize: "0.8rem" }}
            >
              <MenuItem value="set_status">Сменить статус</MenuItem>
              <MenuItem value="assign">Назначить</MenuItem>
              <MenuItem value="dismiss">Dismiss</MenuItem>
            </Select>
          </FormControl>

          {(action === "set_status" || action === "dismiss") && (
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <Select
                value={status}
                onChange={(e) => setStatus(e.target.value as FindingStatus)}
                sx={{ height: 32, fontSize: "0.8rem" }}
              >
                <MenuItem value="new">New</MenuItem>
                <MenuItem value="under_review">Under review</MenuItem>
                <MenuItem value="confirmed">Confirmed</MenuItem>
                <MenuItem value="false_positive">False positive</MenuItem>
                <MenuItem value="out_of_scope">Out of scope</MenuItem>
                <MenuItem value="risk_accepted">Risk accepted</MenuItem>
                <MenuItem value="mitigated">Mitigated</MenuItem>
                <MenuItem value="duplicate">Duplicate</MenuItem>
              </Select>
            </FormControl>
          )}

          {action === "assign" && (
            <TextField
              size="small"
              value={assigneeId}
              onChange={(e) => setAssigneeId(e.target.value)}
              placeholder="UUID пользователя"
              sx={{
                minWidth: 180,
                "& .MuiInputBase-input": { height: 32, py: 0, fontSize: "0.8rem" },
              }}
            />
          )}

          <Tooltip title="Применить">
            <span>
              <IconButton
                size="small"
                onClick={handleApply}
                disabled={effectiveCount === 0 || loading}
                color="primary"
                sx={{
                  bgcolor: "primary.main",
                  color: "primary.contrastText",
                  "&:hover": { bgcolor: "primary.dark" },
                  "&.Mui-disabled": { bgcolor: "action.disabledBackground" },
                }}
              >
                <CheckIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        </Stack>

        {/* Clear button */}
        <Tooltip title="Очистить выбор">
          <IconButton size="small" onClick={onClearSelection}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>
    </Collapse>
  );
};

export default InlineActionsBar;
