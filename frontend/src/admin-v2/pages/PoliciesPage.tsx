import { Grid, MenuItem, Skeleton, Stack, Switch, TextField, Typography } from "@mui/material";
import { useMemo, useState } from "react";
import AdminV2Shell from "../layout/AdminV2Shell";
import { GlassCard } from "../../design-system/components/GlassCard";
import { Button } from "../../design-system/components/Button";
import EmptyState from "../shared/EmptyState";
import FormErrorBanner from "../shared/FormErrorBanner";
import { getOrgSLAPolicy, putOrgSLAPolicy } from "../../api/policies";
import { useEffect } from "react";

type Severity = "critical" | "high" | "medium" | "low";

const severityLabel: Record<Severity, string> = {
  critical: "Критическая",
  high: "Высокая",
  medium: "Средняя",
  low: "Низкая",
};

const PoliciesPage = () => {
  const hasPermission = true;
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const [enabled, setEnabled] = useState(true);
  const [values, setValues] = useState({
    critical: "7",
    high: "30",
    medium: "90",
    low: "180",
    warning: "3",
  });

  const [previewDate, setPreviewDate] = useState("2026-02-10");
  const [previewSeverity, setPreviewSeverity] = useState<Severity>("high");

  const load = async () => {
    setIsLoading(true);
    setHasError(false);
    setServerError(null);
    try {
      const data = await getOrgSLAPolicy();
      const cfg = data.org_default;
      setEnabled(cfg.enabled);
      setValues({
        critical: String(cfg.critical_days),
        high: String(cfg.high_days),
        medium: String(cfg.medium_days),
        low: String(cfg.low_days),
        warning: String(cfg.due_soon_days),
      });
    } catch {
      setHasError(true);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const errors = useMemo(() => {
    const nextErrors: Record<string, string> = {};
    const keys = ["critical", "high", "medium", "low", "warning"] as const;

    keys.forEach((key) => {
      const value = values[key];
      if (!/^\d+$/.test(value.trim())) {
        nextErrors[key] = "Введите целое число";
        return;
      }
      const number = Number(value);
      if (!Number.isInteger(number)) {
        nextErrors[key] = "Введите целое число";
        return;
      }
      if (number < 1 || number > 3650) {
        nextErrors[key] = "Значение должно быть от 1 до 3650";
      }
    });

    const nums = {
      critical: Number(values.critical),
      high: Number(values.high),
      medium: Number(values.medium),
      low: Number(values.low),
      warning: Number(values.warning),
    };
    const minSLA = Math.min(nums.critical || Infinity, nums.high || Infinity, nums.medium || Infinity, nums.low || Infinity);
    if (Number.isFinite(minSLA) && nums.warning > minSLA && !nextErrors.warning) {
      nextErrors.warning = "Порог «Скоро дедлайн» не может быть больше минимального SLA";
    }

    return nextErrors;
  }, [values]);

  const preview = useMemo(() => {
    const base = previewDate ? new Date(`${previewDate}T00:00:00`) : null;
    if (!base || Number.isNaN(base.getTime())) {
      return { due: "—", remaining: null as number | null, dueSoon: false };
    }
    const daysBySeverity: Record<Severity, number> = {
      critical: Number(values.critical) || 0,
      high: Number(values.high) || 0,
      medium: Number(values.medium) || 0,
      low: Number(values.low) || 0,
    };
    const dueSoonDays = Number(values.warning) || 0;
    const addDays = daysBySeverity[previewSeverity];
    const dueDate = new Date(base);
    dueDate.setDate(dueDate.getDate() + addDays);

    const now = new Date();
    const remaining = Math.ceil((dueDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));

    return {
      due: dueDate.toLocaleDateString("ru-RU"),
      remaining,
      dueSoon: remaining <= dueSoonDays,
    };
  }, [previewDate, previewSeverity, values]);

  const save = async () => {
    setServerError(null);
    try {
      await putOrgSLAPolicy({
        enabled,
        critical_days: Number(values.critical),
        high_days: Number(values.high),
        medium_days: Number(values.medium),
        low_days: Number(values.low),
        due_soon_days: Number(values.warning),
      });
      await load();
    } catch (error: any) {
      setServerError(error?.message ?? "Не удалось сохранить SLA политику");
    }
  };

  return (
    <AdminV2Shell title="Политики">
      <Stack spacing={3}>
        {!hasPermission && (
          <EmptyState
            title="У вас нет прав для просмотра этого раздела."
            description="Если доступ нужен для работы, обратитесь к владельцу организации."
          />
        )}

        {hasPermission && hasError && <FormErrorBanner onAction={load} />}

        {hasPermission && !hasError && isLoading && (
          <GlassCard variant="subtle" padding="comfortable">
            <Stack spacing={2}>
              <Skeleton width="40%" />
              <Skeleton height={40} />
              <Skeleton height={40} />
              <Skeleton height={40} />
            </Stack>
          </GlassCard>
        )}

        {hasPermission && !hasError && !isLoading && (
          <GlassCard variant="light" padding="comfortable">
            <Stack spacing={3}>
              <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
                <Stack>
                  <Typography variant="h6" fontWeight={600}>SLA по критичности</Typography>
                  <Typography color="text.secondary">Настройте сроки реакции для инцидентов разной критичности.</Typography>
                </Stack>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography>Включить SLA</Typography>
                  <Switch checked={enabled} onChange={(event) => setEnabled(event.target.checked)} />
                </Stack>
              </Stack>

              {serverError && <FormErrorBanner title={serverError} onAction={() => setServerError(null)} />}

              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <TextField label="Критические — дней" value={values.critical} onChange={(event) => setValues((prev) => ({ ...prev, critical: event.target.value }))} error={Boolean(errors.critical)} helperText={errors.critical ?? "Срок для критичных уязвимостей"} fullWidth />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField label="Высокие — дней" value={values.high} onChange={(event) => setValues((prev) => ({ ...prev, high: event.target.value }))} error={Boolean(errors.high)} helperText={errors.high ?? "Срок для высоких уязвимостей"} fullWidth />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField label="Средние — дней" value={values.medium} onChange={(event) => setValues((prev) => ({ ...prev, medium: event.target.value }))} error={Boolean(errors.medium)} helperText={errors.medium ?? "Срок для средних уязвимостей"} fullWidth />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField label="Низкие — дней" value={values.low} onChange={(event) => setValues((prev) => ({ ...prev, low: event.target.value }))} error={Boolean(errors.low)} helperText={errors.low ?? "Срок для низких уязвимостей"} fullWidth />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField label="Считать «Скоро дедлайн» за — дней" value={values.warning} onChange={(event) => setValues((prev) => ({ ...prev, warning: event.target.value }))} error={Boolean(errors.warning)} helperText={errors.warning ?? "Например, 3 дня до дедлайна"} fullWidth />
                </Grid>
              </Grid>

              <GlassCard variant="subtle" padding="comfortable">
                <Stack spacing={2}>
                  <Typography fontWeight={600}>Пример расчёта</Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={12} md={6}>
                      <TextField type="date" label="Дата обнаружения" value={previewDate} onChange={(event) => setPreviewDate(event.target.value)} fullWidth InputLabelProps={{ shrink: true }} />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <TextField select label="Критичность" value={previewSeverity} onChange={(event) => setPreviewSeverity(event.target.value as Severity)} fullWidth>
                        <MenuItem value="critical">Критическая</MenuItem>
                        <MenuItem value="high">Высокая</MenuItem>
                        <MenuItem value="medium">Средняя</MenuItem>
                        <MenuItem value="low">Низкая</MenuItem>
                      </TextField>
                    </Grid>
                  </Grid>
                  <Typography>
                    Если уязвимость обнаружена {previewDate ? new Date(`${previewDate}T00:00:00`).toLocaleDateString("ru-RU") : "—"} и критичность {severityLabel[previewSeverity].toLowerCase()}, дедлайн: {preview.due}.
                  </Typography>
                  <Typography color={preview.dueSoon ? "warning.main" : "text.secondary"}>
                    До дедлайна: {preview.remaining ?? "—"} дней{preview.dueSoon ? " — скоро дедлайн" : ""}.
                  </Typography>
                </Stack>
              </GlassCard>

              <Stack direction="row" spacing={1} justifyContent="flex-end">
                <Button variant="contained" disabled={Object.keys(errors).length > 0} onClick={save}>Сохранить</Button>
              </Stack>
            </Stack>
          </GlassCard>
        )}
      </Stack>
    </AdminV2Shell>
  );
};

export default PoliciesPage;
