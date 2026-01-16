import {
  Box,
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  SelectChangeEvent,
  Stack,
  TextField,
} from "@mui/material";
import { FindingSeverity, FindingStatus } from "../types/findings";

interface FiltersPanelProps {
  productId: string;
  filterSeverity: FindingSeverity | "";
  filterStatus: FindingStatus | "";
  onProductIdChange: (value: string) => void;
  onSeverityChange: (value: FindingSeverity | "") => void;
  onStatusChange: (value: FindingStatus | "") => void;
  onReset: () => void;
}

const FiltersPanel = ({
  productId,
  filterSeverity,
  filterStatus,
  onProductIdChange,
  onSeverityChange,
  onStatusChange,
  onReset,
}: FiltersPanelProps) => {
  const handleSeverityChange = (event: SelectChangeEvent) => {
    onSeverityChange(event.target.value as FindingSeverity | "");
  };

  const handleStatusChange = (event: SelectChangeEvent) => {
    onStatusChange(event.target.value as FindingStatus | "");
  };

  return (
    <Box
      component="section"
      aria-label="Фильтры списка находок"
      sx={{
        mb: 3,
        p: 2,
        borderRadius: 2,
        border: "1px solid",
        borderColor: "divider",
        backgroundColor: "background.paper",
      }}
    >
      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={2}
        alignItems={{ xs: "stretch", md: "center" }}
      >
        <TextField
          label="Product ID"
          value={productId}
          onChange={(event) => onProductIdChange(event.target.value)}
          size="small"
          placeholder="UUID продукта"
          inputProps={{ "aria-label": "Фильтр по продукту" }}
          sx={{ minWidth: 220 }}
        />

        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel id="filter-severity-label">Критичность</InputLabel>
          <Select
            labelId="filter-severity-label"
            label="Критичность"
            value={filterSeverity}
            onChange={handleSeverityChange}
            inputProps={{ "aria-label": "Фильтр по уровню критичности" }}
          >
            <MenuItem value="">
              <em>Все уровни</em>
            </MenuItem>
            <MenuItem value="low">Low</MenuItem>
            <MenuItem value="medium">Medium</MenuItem>
            <MenuItem value="high">High</MenuItem>
            <MenuItem value="critical">Critical</MenuItem>
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel id="filter-status-label">Статус</InputLabel>
          <Select
            labelId="filter-status-label"
            label="Статус"
            value={filterStatus}
            onChange={handleStatusChange}
            inputProps={{ "aria-label": "Фильтр по статусу" }}
          >
            <MenuItem value="">
              <em>Все статусы</em>
            </MenuItem>
            <MenuItem value="new">New</MenuItem>
            <MenuItem value="duplicate">Duplicate</MenuItem>
            <MenuItem value="resolved">Resolved</MenuItem>
            <MenuItem value="ignored">Ignored</MenuItem>
          </Select>
        </FormControl>

        <Button
          variant="outlined"
          color="inherit"
          onClick={onReset}
          sx={{ alignSelf: { xs: "stretch", md: "center" } }}
        >
          Сбросить
        </Button>
      </Stack>
    </Box>
  );
};

export default FiltersPanel;
