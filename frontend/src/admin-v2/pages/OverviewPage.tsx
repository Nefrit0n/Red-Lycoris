import { Box, Grid, Skeleton, Stack, Typography } from "@mui/material";
import AdminV2Shell from "../layout/AdminV2Shell";
import { GlassCard } from "../../design-system/components/GlassCard";
import { StatusBadge } from "../../design-system/components/StatusBadge";
import FormErrorBanner from "../shared/FormErrorBanner";
import EmptyState from "../shared/EmptyState";

const OverviewPage = () => {
  const hasPermission = true;
  const isLoading = false;
  const hasError = false;

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
