import { Box, Grid, MenuItem, Skeleton, Stack, TextField, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import AdminV2Shell from "../layout/AdminV2Shell";
import { GlassCard } from "../../design-system/components/GlassCard";
import { StatusBadge } from "../../design-system/components/StatusBadge";
import FormErrorBanner from "../shared/FormErrorBanner";
import EmptyState from "../shared/EmptyState";
import { getBduSyncStatus, updateBduSyncInterval, type BduSyncStatus } from "../../api/adminBdu";

const OverviewPage = () => {
  const hasPermission = true;
  const isLoading = false;
  const hasError = false;
  const [bduStatus, setBduStatus] = useState<BduSyncStatus | null>(null);
  const [bduInterval, setBduInterval] = useState<string>("24");

  useEffect(() => {
    let mounted = true;
    getBduSyncStatus()
      .then((status) => {
        if (!mounted) return;
        setBduStatus(status);
        setBduInterval(String(status.sync_interval_hours));
      })
      .catch(() => undefined);
    return () => {
      mounted = false;
    };
  }, []);

  const handleBduIntervalChange = async (value: string) => {
    setBduInterval(value);
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 1) return;
    try {
      await updateBduSyncInterval(parsed);
      const status = await getBduSyncStatus();
      setBduStatus(status);
    } catch {
      // ignored on purpose, old value remains selected
    }
  };

  const summary = [
    { label: "Пользователи", value: "128", delta: "+4 за неделю" },
    { label: "Команды", value: "18", delta: "2 новые" },
    { label: "Проекты", value: "24", delta: "1 на согласовании" },
    { label: "Ожидают доступа", value: "5", delta: "требуют ревью" },
  ];

  return (
    <AdminV2Shell title="Администрирование">
      <Stack spacing={3}>
        {!hasPermission && (
          <EmptyState
            title="У вас нет прав для просмотра этого раздела."
            description="Если доступ нужен для работы, обратитесь к владельцу организации."
          />
        )}

        {hasPermission && hasError && (
          <FormErrorBanner onAction={() => undefined} />
        )}

        {hasPermission && !hasError && summary.length === 0 && (
          <EmptyState
            title="Пока нет данных для обзора."
            description="Добавьте команды и пользователей, чтобы начать управление доступом."
            actionLabel="Перейти к пользователям"
          />
        )}

        {hasPermission && !hasError && summary.length > 0 && (
          <Grid container spacing={2}>
            {summary.map((item) => (
              <Grid item xs={12} md={6} lg={3} key={item.label}>
                <GlassCard variant="light" padding="comfortable">
                  <Stack spacing={1}>
                    <Typography color="text.secondary" variant="subtitle2">
                      {item.label}
                    </Typography>
                    <Typography variant="h3" fontWeight={700}>
                      {item.value}
                    </Typography>
                    <Box>
                      <StatusBadge type="severity" value="info" label={item.delta} />
                    </Box>
                  </Stack>
                </GlassCard>
              </Grid>
            ))}
          </Grid>
        )}

        {hasPermission && isLoading && (
          <Grid container spacing={2}>
            {Array.from({ length: 4 }).map((_, index) => (
              <Grid item xs={12} md={6} lg={3} key={`skeleton-${index}`}>
                <GlassCard variant="subtle" padding="comfortable">
                  <Stack spacing={1.5}>
                    <Skeleton width="40%" />
                    <Skeleton variant="rounded" height={36} width="60%" />
                    <Skeleton width="70%" />
                  </Stack>
                </GlassCard>
              </Grid>
            ))}
          </Grid>
        )}


        {hasPermission && !hasError && (
          <GlassCard variant="subtle" padding="comfortable">
            <Stack spacing={2}>
              <Typography variant="h6" fontWeight={600}>
                БДУ ФСТЭК
              </Typography>
              <Typography color="text.secondary">
                Частота обновления локальной базы БДУ ФСТЭК из Excel-файла vullist.xlsx.
              </Typography>
              <TextField
                select
                label="Частота обновления базы БДУ ФСТЭК"
                value={bduInterval}
                onChange={(event) => void handleBduIntervalChange(event.target.value)}
                sx={{ maxWidth: 420 }}
              >
                <MenuItem value="1">Каждый час</MenuItem>
                <MenuItem value="6">Каждые 6 часов</MenuItem>
                <MenuItem value="12">Каждые 12 часов</MenuItem>
                <MenuItem value="24">Каждые 24 часа</MenuItem>
                <MenuItem value="48">Каждые 48 часов</MenuItem>
              </TextField>
              {bduStatus && (
                <Typography variant="body2" color="text.secondary">
                  Записей в локальной базе: {bduStatus.record_count}. Последняя синхронизация: {bduStatus.last_synced_at ?? "еще не выполнялась"}.
                </Typography>
              )}
            </Stack>
          </GlassCard>
        )}
        {hasPermission && !hasError && (
          <GlassCard variant="subtle" padding="comfortable">
            <Stack spacing={2}>
              <Typography variant="h6" fontWeight={600}>
                Быстрые действия
              </Typography>
              <Typography color="text.secondary">
                Упростите управление доступом — приглашайте пользователей, назначайте команды и проверяйте
                актуальные политики безопасности.
              </Typography>
            </Stack>
          </GlassCard>
        )}
      </Stack>
    </AdminV2Shell>
  );
};

export default OverviewPage;
