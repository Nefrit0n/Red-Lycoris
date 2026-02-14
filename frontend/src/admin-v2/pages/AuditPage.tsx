import {
  Stack,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
} from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import AdminV2Shell from "../layout/AdminV2Shell";
import DataTable, { TableEmptyState, TableLoadingRows } from "../../components/DataTable";
import EmptyState from "../shared/EmptyState";
import FormErrorBanner from "../shared/FormErrorBanner";
import AuditEventDrawer from "./drawers/AuditEventDrawer";
import { Button } from "../../design-system/components/Button";

interface AuditEvent {
  id: string;
  occurredAt: string;
  actorName?: string;
  action: string;
  targetType: string;
  targetId?: string;
  payload?: Record<string, unknown>;
}

const AuditPage = () => {
  const hasPermission = true;
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [drawerEvent, setDrawerEvent] = useState<AuditEvent | null>(null);
  const [period, setPeriod] = useState("");
  const [user, setUser] = useState("");
  const [action, setAction] = useState("");
  const [target, setTarget] = useState("");

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (user) params.set("q", user);
    if (action) params.set("action", action);
    if (target) params.set("target_type", target);
    params.set("limit", "50");
    return params.toString();
  }, [user, action, target]);

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      setIsLoading(true);
      setHasError(false);
      try {
        const response = await fetch(`/api/v1/admin/audit?${query}`, { signal: controller.signal });
        if (!response.ok) {
          throw new Error("failed");
        }
        const payload = await response.json();
        setEvents(payload.data ?? []);
      } catch {
        setHasError(true);
      } finally {
        setIsLoading(false);
      }
    };
    load();
    return () => controller.abort();
  }, [query]);

  const exportUrl = `/api/v1/admin/audit/export?from=${encodeURIComponent(
    new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  )}&to=${encodeURIComponent(new Date().toISOString())}&action=${encodeURIComponent(action)}&target_type=${encodeURIComponent(target)}`;

  return (
    <AdminV2Shell title="Журнал аудита">
      <Stack spacing={3}>
        {!hasPermission && (
          <EmptyState
            title="У вас нет прав для просмотра этого раздела."
            description="Если доступ нужен для работы, обратитесь к владельцу организации."
          />
        )}

        {hasPermission && hasError && <FormErrorBanner onAction={() => window.location.reload()} />}

        {hasPermission && !hasError && (
          <Stack spacing={2}>
            <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
              <TextField label="Период" placeholder="Например, последние 30 дней" value={period} onChange={(event) => setPeriod(event.target.value)} fullWidth />
              <TextField label="Пользователь" placeholder="Введите имя или email" value={user} onChange={(event) => setUser(event.target.value)} fullWidth />
            </Stack>
            <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
              <TextField label="Действие" placeholder="Например, admin.user.role_changed" value={action} onChange={(event) => setAction(event.target.value)} fullWidth />
              <TextField label="Объект" placeholder="user | team | product | policy" value={target} onChange={(event) => setTarget(event.target.value)} fullWidth />
            </Stack>
            <Stack direction="row" spacing={1}>
              <Button variant="outlined" color="inherit" onClick={() => { setPeriod(""); setUser(""); setAction(""); setTarget(""); }}>
                Сбросить фильтры
              </Button>
              <Button component="a" href={exportUrl} variant="contained">
                Экспорт
              </Button>
            </Stack>

            <DataTable minWidth={880}>
              <TableHead>
                <TableRow>
                  <TableCell>Время</TableCell>
                  <TableCell>Кто</TableCell>
                  <TableCell>Действие</TableCell>
                  <TableCell>Объект</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {isLoading && <TableLoadingRows rowCount={5} cellCount={4} />}

                {!isLoading && events.length === 0 && (
                  <TableEmptyState
                    colSpan={4}
                    title="События не найдены"
                    description="Попробуйте изменить фильтры или период."
                  />
                )}

                {!isLoading &&
                  events.map((event) => (
                    <TableRow key={event.id} hover sx={{ cursor: "pointer" }} onClick={() => setDrawerEvent(event)}>
                      <TableCell>{event.occurredAt}</TableCell>
                      <TableCell>{event.actorName ?? "Системный пользователь"}</TableCell>
                      <TableCell>{event.action}</TableCell>
                      <TableCell>{event.targetType}</TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </DataTable>
          </Stack>
        )}
      </Stack>

      <AuditEventDrawer
        open={Boolean(drawerEvent)}
        event={
          drawerEvent
            ? {
                time: drawerEvent.occurredAt,
                actor: drawerEvent.actorName ?? "Сервис",
                action: drawerEvent.action,
                target: drawerEvent.targetType,
                changes: [JSON.stringify(drawerEvent.payload ?? {}, null, 2)],
              }
            : undefined
        }
        onClose={() => setDrawerEvent(null)}
      />
    </AdminV2Shell>
  );
};

export default AuditPage;
