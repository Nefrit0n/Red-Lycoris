import {
  Box,
  Divider,
  Drawer,
  Stack,
  Switch,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import AdminV2Shell from "../layout/AdminV2Shell";
import DataTable, { TableEmptyState, TableLoadingRows, TableChip } from "../../components/DataTable";
import EmptyState from "../shared/EmptyState";
import FormErrorBanner from "../shared/FormErrorBanner";
import { Button } from "../../design-system/components/Button";
import {
  deleteProductTeamRole,
  deleteProductUserRole,
  getEffectiveAccess,
  getProductAccess,
  listAdminProducts,
  putProductTeamRole,
  putProductUserRole,
} from "../../api/adminTeamsProjects";
import { deleteProductSLAPolicy, getProductSLAPolicy, putProductSLAPolicy, SLAPolicySettings } from "../../api/policies";

const ProjectsPage = () => {
  const hasPermission = true;
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [projects, setProjects] = useState<Array<{ id: string; name: string }>>([]);
  const [drawerProject, setDrawerProject] = useState<{ id: string; name: string } | null>(null);
  const [access, setAccess] = useState<{ teams: Array<{ team_id: string; team_name: string; role: string }>; users: Array<{ user_id: string; email: string; full_name: string | null; role: string }> }>({ teams: [], users: [] });
  const [effectiveUser, setEffectiveUser] = useState("");
  const [effective, setEffective] = useState<{ effective_role: string; sources: Array<{ type: string; role: string; detail: string; team_name?: string }> } | null>(null);

  const [effectiveSLA, setEffectiveSLA] = useState<SLAPolicySettings | null>(null);
  const [overrideEnabled, setOverrideEnabled] = useState(false);
  const [overrideValues, setOverrideValues] = useState({ critical: "", high: "", medium: "", low: "", dueSoon: "", enabled: true });

  const loadProjects = async () => {
    setIsLoading(true);
    setHasError(false);
    try {
      setProjects(await listAdminProducts());
    } catch {
      setHasError(true);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { loadProjects(); }, []);

  useEffect(() => {
    if (!drawerProject) return;
    const load = async () => {
      const [nextAccess, slaPolicy] = await Promise.all([
        getProductAccess(drawerProject.id),
        getProductSLAPolicy(drawerProject.id),
      ]);
      setAccess(nextAccess);
      setEffectiveSLA(slaPolicy.effective);
      setOverrideEnabled(Boolean(slaPolicy.override));
      const src = slaPolicy.override ?? slaPolicy.effective;
      setOverrideValues({
        critical: String(src.critical_days),
        high: String(src.high_days),
        medium: String(src.medium_days),
        low: String(src.low_days),
        dueSoon: String(src.due_soon_days),
        enabled: src.enabled,
      });
    };
    load();
  }, [drawerProject]);

  const overrideError = useMemo(() => {
    if (!overrideEnabled) return null;
    const fields = [overrideValues.critical, overrideValues.high, overrideValues.medium, overrideValues.low, overrideValues.dueSoon];
    for (const value of fields) {
      if (!/^\d+$/.test(value.trim())) return "Введите целое число";
      const n = Number(value);
      if (n < 1 || n > 3650) return "Значение должно быть от 1 до 3650";
    }
    const minSLA = Math.min(Number(overrideValues.critical), Number(overrideValues.high), Number(overrideValues.medium), Number(overrideValues.low));
    if (Number(overrideValues.dueSoon) > minSLA) return "Порог «Скоро дедлайн» не может быть больше минимального SLA";
    return null;
  }, [overrideEnabled, overrideValues]);

  return (
    <AdminV2Shell title="Проекты">
      <Stack spacing={3}>
        {!hasPermission && <EmptyState title="У вас нет прав для просмотра этого раздела." description="Если доступ нужен для работы, обратитесь к владельцу организации." />}
        {hasPermission && hasError && <FormErrorBanner onAction={loadProjects} />}

        {hasPermission && !hasError && (
          <DataTable minWidth={900}>
            <TableHead>
              <TableRow>
                <TableCell>Проект</TableCell>
                <TableCell>Команды с доступом</TableCell>
                <TableCell>Пользователи с прямым доступом</TableCell>
                <TableCell>Статус</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading && <TableLoadingRows rowCount={4} cellCount={4} />}
              {!isLoading && projects.length === 0 && <TableEmptyState colSpan={4} title="Проекты не найдены" description="Добавьте проекты для управления доступом." />}
              {!isLoading && projects.map((project) => (
                <TableRow key={project.id} hover sx={{ cursor: "pointer" }} onClick={() => setDrawerProject(project)}>
                  <TableCell><Typography fontWeight={600}>{project.name}</Typography></TableCell>
                  <TableCell>—</TableCell>
                  <TableCell>—</TableCell>
                  <TableCell><TableChip label="Активен" color="success" /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </DataTable>
        )}
      </Stack>

      <Drawer anchor="right" open={Boolean(drawerProject)} onClose={() => setDrawerProject(null)} PaperProps={{ sx: { width: 640 } }}>
        <Box sx={{ p: 3 }}>
          <Stack spacing={2}>
            <Typography variant="h6" fontWeight={700}>{drawerProject?.name ?? "Проект"}</Typography>
            <Divider />

            <Stack spacing={1.5}>
              <Typography fontWeight={600}>SLA для проекта</Typography>
              <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                <Typography>Переопределить SLA для проекта</Typography>
                <Switch checked={overrideEnabled} onChange={(e) => setOverrideEnabled(e.target.checked)} />
              </Stack>

              {overrideEnabled ? (
                <Stack spacing={1.5}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography>Включить SLA</Typography>
                    <Switch checked={overrideValues.enabled} onChange={(e) => setOverrideValues((prev) => ({ ...prev, enabled: e.target.checked }))} />
                  </Stack>
                  <TextField label="Критические — дней" value={overrideValues.critical} onChange={(e) => setOverrideValues((p) => ({ ...p, critical: e.target.value }))} />
                  <TextField label="Высокие — дней" value={overrideValues.high} onChange={(e) => setOverrideValues((p) => ({ ...p, high: e.target.value }))} />
                  <TextField label="Средние — дней" value={overrideValues.medium} onChange={(e) => setOverrideValues((p) => ({ ...p, medium: e.target.value }))} />
                  <TextField label="Низкие — дней" value={overrideValues.low} onChange={(e) => setOverrideValues((p) => ({ ...p, low: e.target.value }))} />
                  <TextField label="Скоро дедлайн — дней" value={overrideValues.dueSoon} onChange={(e) => setOverrideValues((p) => ({ ...p, dueSoon: e.target.value }))} error={Boolean(overrideError)} helperText={overrideError ?? ""} />
                  <Stack direction="row" spacing={1}>
                    <Button
                      variant="contained"
                      disabled={Boolean(overrideError) || !drawerProject}
                      onClick={async () => {
                        if (!drawerProject || overrideError) return;
                        await putProductSLAPolicy(drawerProject.id, {
                          override_enabled: true,
                          enabled: overrideValues.enabled,
                          critical_days: Number(overrideValues.critical),
                          high_days: Number(overrideValues.high),
                          medium_days: Number(overrideValues.medium),
                          low_days: Number(overrideValues.low),
                          due_soon_days: Number(overrideValues.dueSoon),
                        });
                        const reloaded = await getProductSLAPolicy(drawerProject.id);
                        setEffectiveSLA(reloaded.effective);
                      }}
                    >
                      Сохранить SLA override
                    </Button>
                    <Button variant="outlined" color="inherit" onClick={async () => {
                      if (!drawerProject) return;
                      await deleteProductSLAPolicy(drawerProject.id);
                      const reloaded = await getProductSLAPolicy(drawerProject.id);
                      setOverrideEnabled(false);
                      setEffectiveSLA(reloaded.effective);
                    }}>
                      Сбросить override
                    </Button>
                  </Stack>
                </Stack>
              ) : (
                <Typography color="text.secondary">Наследуется из настроек организации.</Typography>
              )}

              <Box sx={{ p: 1.5, border: "1px solid", borderColor: "divider", borderRadius: 1.5 }}>
                <Typography fontWeight={600}>Эффективные значения</Typography>
                <Typography variant="body2" color="text.secondary">
                  {effectiveSLA
                    ? `SLA: ${effectiveSLA.enabled ? "включен" : "выключен"}, критические ${effectiveSLA.critical_days}д, высокие ${effectiveSLA.high_days}д, средние ${effectiveSLA.medium_days}д, низкие ${effectiveSLA.low_days}д, скоро дедлайн ${effectiveSLA.due_soon_days}д.`
                    : "Загрузка..."}
                </Typography>
              </Box>
            </Stack>

            <Divider />

            <Stack spacing={1.5}>
              <Typography fontWeight={600}>Команды</Typography>
              {access.teams.map((team) => (
                <Stack key={team.team_id} direction="row" spacing={1} alignItems="center">
                  <TextField value={team.team_name} size="small" fullWidth disabled />
                  <TextField value={team.role} size="small" sx={{ width: 160 }} disabled />
                  <Button variant="text" color="inherit" onClick={async () => {
                    if (!drawerProject) return;
                    await deleteProductTeamRole(drawerProject.id, team.team_id);
                    setAccess(await getProductAccess(drawerProject.id));
                  }}>Удалить</Button>
                </Stack>
              ))}
              <Button variant="outlined" onClick={async () => {
                if (!drawerProject) return;
                const teamId = window.prompt("ID команды");
                if (!teamId) return;
                await putProductTeamRole(drawerProject.id, teamId, "viewer");
                setAccess(await getProductAccess(drawerProject.id));
              }}>Добавить команду</Button>
            </Stack>

            <Divider />

            <Stack spacing={1.5}>
              <Typography fontWeight={600}>Пользователи</Typography>
              {access.users.map((user) => (
                <Stack key={user.user_id} direction="row" spacing={1} alignItems="center">
                  <TextField value={user.full_name ?? user.email} size="small" fullWidth disabled />
                  <TextField value={user.role} size="small" sx={{ width: 160 }} disabled />
                  <Button variant="text" color="inherit" onClick={async () => {
                    if (!drawerProject) return;
                    await deleteProductUserRole(drawerProject.id, user.user_id);
                    setAccess(await getProductAccess(drawerProject.id));
                  }}>Удалить</Button>
                </Stack>
              ))}
              <Button variant="outlined" onClick={async () => {
                if (!drawerProject) return;
                const userId = window.prompt("ID пользователя");
                if (!userId) return;
                await putProductUserRole(drawerProject.id, userId, "viewer");
                setAccess(await getProductAccess(drawerProject.id));
              }}>Добавить пользователя</Button>
            </Stack>

            <Divider />

            <Stack spacing={1.5}>
              <Typography fontWeight={600}>Эффективные права</Typography>
              <TextField label="Эффективные права" placeholder="Введите ID пользователя" value={effectiveUser} onChange={(event) => setEffectiveUser(event.target.value)} />
              <Button variant="outlined" onClick={async () => {
                if (!drawerProject || !effectiveUser) return;
                setEffective(await getEffectiveAccess(drawerProject.id, effectiveUser));
              }}>Показать</Button>
              {effective && (
                <Box sx={{ p: 2, border: "1px solid", borderColor: "divider", borderRadius: 2 }}>
                  <Typography fontWeight={600}>Итоговая роль: {effective.effective_role}</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1, mb: 1 }}>Источник прав</Typography>
                  {effective.sources.map((source, index) => (
                    <Typography key={`${source.type}-${index}`} color="text.secondary">• {source.type === "direct" ? "Прямой доступ" : `Команда ${source.team_name ?? ""}`}: {source.role}</Typography>
                  ))}
                </Box>
              )}
            </Stack>
          </Stack>
        </Box>
      </Drawer>
    </AdminV2Shell>
  );
};

export default ProjectsPage;
