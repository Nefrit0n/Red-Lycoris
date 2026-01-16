import {
  Box,
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useState } from "react";
import { FindingStatus } from "../types/findings";

type BulkAction = "set_status" | "assign" | "dismiss";

interface BulkActionsBarProps {
  selectedCount: number;
  onApply: (action: BulkAction, payload: Record<string, unknown>) => void;
}

const BulkActionsBar = ({ selectedCount, onApply }: BulkActionsBarProps) => {
  const [action, setAction] = useState<BulkAction>("set_status");
  const [status, setStatus] = useState<FindingStatus>("under_review");
  const [assigneeId, setAssigneeId] = useState("");

  const handleApply = () => {
    if (action === "set_status") {
      onApply(action, { status });
      return;
    }
    if (action === "dismiss") {
      onApply(action, { status });
      return;
    }
    onApply(action, { userId: assigneeId || null });
  };

  return (
    <Box
      sx={{
        p: 2,
        borderRadius: 2,
        border: "1px solid",
        borderColor: "divider",
        backgroundColor: "background.paper",
        mb: 2,
      }}
    >
      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={2}
        alignItems={{ xs: "stretch", md: "center" }}
      >
        <Typography variant="subtitle2">
          Выбрано: {selectedCount}
        </Typography>

        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel id="bulk-action-label">Действие</InputLabel>
          <Select
            labelId="bulk-action-label"
            label="Действие"
            value={action}
            onChange={(event) => {
              const nextAction = event.target.value as BulkAction;
              setAction(nextAction);
              if (nextAction === "dismiss") {
                setStatus("false_positive");
              }
            }}
          >
            <MenuItem value="set_status">Сменить статус</MenuItem>
            <MenuItem value="assign">Назначить</MenuItem>
            <MenuItem value="dismiss">Dismiss</MenuItem>
          </Select>
        </FormControl>

        {(action === "set_status" || action === "dismiss") && (
          <FormControl size="small" sx={{ minWidth: 220 }}>
            <InputLabel id="bulk-status-label">Статус</InputLabel>
            <Select
              labelId="bulk-status-label"
              label="Статус"
              value={status}
              onChange={(event) => setStatus(event.target.value as FindingStatus)}
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
            label="User ID"
            size="small"
            value={assigneeId}
            onChange={(event) => setAssigneeId(event.target.value)}
            placeholder="UUID пользователя"
            sx={{ minWidth: 240 }}
          />
        )}

        <Button
          variant="contained"
          onClick={handleApply}
          disabled={selectedCount === 0}
        >
          Применить
        </Button>
      </Stack>
    </Box>
  );
};

export default BulkActionsBar;
