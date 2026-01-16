import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  IconButton,
  MenuItem,
  Paper,
  Snackbar,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import {
  assignResponsible,
  fetchFindingDetail,
  updateFindingStatus,
} from "../api/findings";
import {
  FindingDetail,
  FindingDetailStatus,
  FindingSeverity,
  HistoryItem,
} from "../types/findings";

const severityStyles: Record<FindingSeverity, { label: string; color: string }> = {
  low: { label: "Low", color: "#2e7d32" },
  medium: { label: "Medium", color: "#ed6c02" },
  high: { label: "High", color: "#d32f2f" },
  critical: { label: "Critical", color: "#7b1fa2" },
};

const statusLabels: Record<FindingDetailStatus, string> = {
  open: "Открыта",
  closed: "Закрыта",
  false_positive: "Ложное срабатывание",
};

const availableUsers = [
  { id: "u-001", name: "Анна Иванова" },
  { id: "u-002", name: "Илья Петров" },
  { id: "u-003", name: "Мария Смирнова" },
  { id: "u-004", name: "Никита Орлов" },
];

interface StatusChangerProps {
  status: FindingDetailStatus;
  onChange: (status: FindingDetailStatus) => void;
  disabled?: boolean;
}

const StatusChanger = ({ status, onChange, disabled }: StatusChangerProps) => (
  <TextField
    select
    label="Статус"
    value={status}
    onChange={(event) => onChange(event.target.value as FindingDetailStatus)}
    SelectProps={{ native: false }}
    fullWidth
    disabled={disabled}
  aria-label="Сменить статус"
>
  {Object.entries(statusLabels).map(([value, label]) => (
    <MenuItem key={value} value={value}>
      {label}
    </MenuItem>
  ))}
</TextField>
);

interface ResponsibleAssignerProps {
  responsible: FindingDetail["responsible"];
  onAssign: (userId: string) => void;
  disabled?: boolean;
}

const ResponsibleAssigner = ({
  responsible,
  onAssign,
  disabled,
}: ResponsibleAssignerProps) => {
  const [open, setOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<
    { id: string; name: string } | null
  >(null);

  return (
    <>
      {responsible ? (
        <Stack direction="row" spacing={1} alignItems="center">
          <PersonOutlineIcon fontSize="small" color="action" />
          <Typography variant="body2">{responsible.name}</Typography>
          <Button
            size="small"
            variant="text"
            onClick={() => setOpen(true)}
            disabled={disabled}
            aria-label="Изменить ответственного"
          >
            Изменить
          </Button>
        </Stack>
      ) : (
        <Button
          size="small"
          variant="outlined"
          onClick={() => setOpen(true)}
          disabled={disabled}
          aria-label="Назначить ответственного"
        >
          Назначить
        </Button>
      )}

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        fullWidth
        maxWidth="sm"
        aria-labelledby="assign-responsible-title"
      >
        <DialogTitle id="assign-responsible-title">
          Назначить ответственного
        </DialogTitle>
        <DialogContent>
          <Autocomplete
            options={availableUsers}
            getOptionLabel={(option) => option.name}
            value={selectedUser}
            onChange={(_, value) => setSelectedUser(value)}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Выберите пользователя"
                margin="normal"
                aria-label="Выбор пользователя"
              />
            )}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)} aria-label="Отмена">
            Отмена
          </Button>
          <Button
            variant="contained"
            onClick={() => {
              if (selectedUser) {
                onAssign(selectedUser.id);
              }
              setOpen(false);
            }}
            disabled={!selectedUser || disabled}
            aria-label="Подтвердить назначение"
          >
            Назначить
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

interface HistoryTableProps {
  history: HistoryItem[];
}

const HistoryTable = ({ history }: HistoryTableProps) => (
  <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 320 }}>
    <Table stickyHeader size="small" aria-label="История изменений">
      <TableHead>
        <TableRow>
          <TableCell>Время</TableCell>
          <TableCell>Поле</TableCell>
          <TableCell>Изменение</TableCell>
          <TableCell>Пользователь</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {history.map((item) => (
          <TableRow key={`${item.timestamp}-${item.field}-${item.changedBy}`}>
            <TableCell>
              {new Date(item.timestamp).toLocaleString()}
            </TableCell>
            <TableCell>{item.field}</TableCell>
            <TableCell>
              {item.oldValue} → {item.newValue}
            </TableCell>
            <TableCell>{item.changedBy}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </TableContainer>
);

const FindingDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<FindingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState<{
    message: string;
    severity: "success" | "error";
  } | null>(null);

  const fetchDetail = useCallback(async (signal?: AbortSignal) => {
    if (!id) return;
    setLoading(true);
    setError(null);

    try {
      const response = await fetchFindingDetail(id, signal);
      setData(response);
    } catch (fetchError) {
      if (!(fetchError instanceof DOMException && fetchError.name === "AbortError")) {
        setError("Не удалось загрузить детали уязвимости.");
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    const controller = new AbortController();
    fetchDetail(controller.signal);
    return () => controller.abort();
  }, [fetchDetail]);

  const handleCopy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setSnackbar({ message: "Путь скопирован", severity: "success" });
    } catch (copyError) {
      setSnackbar({ message: "Не удалось скопировать путь", severity: "error" });
    }
  };

  const handleStatusChange = async (status: FindingDetailStatus) => {
    if (!id) return;
    setActionLoading(true);
    try {
      await updateFindingStatus(id, status);
      setSnackbar({ message: "Статус обновлён", severity: "success" });
      fetchDetail();
    } catch (updateError) {
      setSnackbar({ message: "Ошибка обновления статуса", severity: "error" });
    } finally {
      setActionLoading(false);
    }
  };

  const handleAssign = async (userId: string) => {
    if (!id) return;
    setActionLoading(true);
    try {
      await assignResponsible(id, userId);
      setSnackbar({ message: "Ответственный назначен", severity: "success" });
      fetchDetail();
    } catch (assignError) {
      setSnackbar({ message: "Ошибка назначения", severity: "error" });
    } finally {
      setActionLoading(false);
    }
  };

  const severityTag = data
    ? severityStyles[data.severity]
    : { label: "", color: "transparent" };

  const steps = useMemo(() => {
    if (!data?.stepsToReproduce) return [];
    return data.stepsToReproduce
      .split("\n")
      .map((step) => step.trim())
      .filter(Boolean);
  }, [data?.stepsToReproduce]);

  const sortedHistory = useMemo(() => {
    if (!data?.history) return [];
    return [...data.history].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }, [data?.history]);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <CircularProgress aria-label="Загрузка деталей" />
      </Box>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 4, md: 6 } }}>
      <Stack spacing={1} mb={4}>
        <Typography variant="overline" color="text.secondary">
          Детали уязвимости
        </Typography>
        <Typography variant="h4" component="h1">
          Детали уязвимости — {data?.title ?? ""}
        </Typography>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} aria-label="Ошибка загрузки">
          {error}
        </Alert>
      )}

      {data && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={8}>
            <Paper variant="outlined" sx={{ p: { xs: 2.5, md: 3 } }}>
              <Stack spacing={2.5}>
                <Box>
                  <Typography variant="h5" fontWeight={600} gutterBottom>
                    {data.title}
                  </Typography>
                  <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                    <Chip
                      label={severityTag.label}
                      sx={{
                        bgcolor: severityTag.color,
                        color: "common.white",
                        fontWeight: 600,
                      }}
                    />
                    <Chip
                      label={statusLabels[data.status]}
                      variant="outlined"
                      color="primary"
                      sx={{ fontWeight: 500 }}
                    />
                    <Typography variant="caption" color="text.secondary">
                      Создано: {new Date(data.createdAt).toLocaleString()}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Обновлено: {new Date(data.updatedAt).toLocaleString()}
                    </Typography>
                  </Stack>
                </Box>

                <Box>
                  <Typography variant="subtitle2" color="text.secondary">
                    Path / URL
                  </Typography>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography
                      variant="body2"
                      sx={{ wordBreak: "break-all", fontWeight: 500 }}
                    >
                      {data.path}
                    </Typography>
                    <IconButton
                      size="small"
                      onClick={() => handleCopy(data.path)}
                      aria-label="Скопировать путь"
                    >
                      <ContentCopyIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                </Box>

                <Divider />

                <Box>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Description
                  </Typography>
                  <Typography
                    variant="body1"
                    sx={{ whiteSpace: "pre-line", fontWeight: 600 }}
                  >
                    {data.description}
                  </Typography>
                </Box>

                <Box>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Steps to Reproduce
                  </Typography>
                  <ol style={{ paddingLeft: 20, margin: 0 }}>
                    {steps.map((step) => (
                      <li key={step}>
                        <Typography variant="body2" sx={{ mb: 0.5 }}>
                          {step}
                        </Typography>
                      </li>
                    ))}
                  </ol>
                </Box>

                <Box>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Recommendation
                  </Typography>
                  <Typography variant="body2" sx={{ whiteSpace: "pre-line" }}>
                    {data.recommendation}
                  </Typography>
                </Box>
              </Stack>
            </Paper>
          </Grid>

          <Grid item xs={12} md={4}>
            <Paper variant="outlined" sx={{ p: { xs: 2.5, md: 3 } }}>
              <Stack spacing={2.5}>
                <Typography variant="h6">Управление</Typography>
                <StatusChanger
                  status={data.status}
                  onChange={handleStatusChange}
                  disabled={actionLoading}
                />
                <Box>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Ответственный
                  </Typography>
                  <ResponsibleAssigner
                    responsible={data.responsible}
                    onAssign={handleAssign}
                    disabled={actionLoading}
                  />
                </Box>
                {actionLoading && (
                  <Stack direction="row" spacing={1} alignItems="center">
                    <CircularProgress size={20} />
                    <Typography variant="body2" color="text.secondary">
                      Обновляем данные...
                    </Typography>
                  </Stack>
                )}
              </Stack>
            </Paper>
          </Grid>

          <Grid item xs={12}>
            <Stack spacing={1.5}>
              <Typography variant="h6">История изменений</Typography>
              <HistoryTable history={sortedHistory} />
            </Stack>
          </Grid>
        </Grid>
      )}

      <Snackbar
        open={Boolean(snackbar)}
        autoHideDuration={4000}
        onClose={() => setSnackbar(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        {snackbar ? (
          <Alert severity={snackbar.severity} variant="filled">
            {snackbar.message}
          </Alert>
        ) : null}
      </Snackbar>
    </Container>
  );
};

export default FindingDetailPage;
