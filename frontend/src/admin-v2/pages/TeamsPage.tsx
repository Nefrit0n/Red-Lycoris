import {
  Stack,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { useEffect, useState } from "react";
import AdminV2Shell from "../layout/AdminV2Shell";
import DataTable, { TableEmptyState, TableLoadingRows } from "../../components/DataTable";
import EmptyState from "../shared/EmptyState";
import FormErrorBanner from "../shared/FormErrorBanner";
import TeamDrawer from "./drawers/TeamDrawer";
import { createTeam, listTeams } from "../../api/adminTeamsProjects";

interface TeamRow {
  id: string;
  name: string;
  members_count: number;
  products_count: number;
  updated_at: string;
}

const TeamsPage = () => {
  const hasPermission = true;
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [drawerTeam, setDrawerTeam] = useState<TeamRow | null>(null);

  const load = async () => {
    setIsLoading(true);
    setHasError(false);
    try {
      const response = await listTeams({ limit: 50 });
      setTeams(response.items);
    } catch {
      setHasError(true);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <AdminV2Shell
      title="Команды"
      primaryAction={{
        label: "Создать команду",
        onClick: async () => {
          const name = window.prompt("Название команды");
          if (!name) return;
          await createTeam({ name });
          await load();
        },
      }}
    >
      <Stack spacing={3}>
        {!hasPermission && (
          <EmptyState title="У вас нет прав для просмотра этого раздела." description="Если доступ нужен для работы, обратитесь к владельцу организации." />
        )}

        {hasPermission && hasError && <FormErrorBanner onAction={load} />}

        {hasPermission && !hasError && teams.length === 0 && !isLoading && (
          <EmptyState title="Команды еще не созданы." description="Создайте первую команду, чтобы распределять роли по проектам." actionLabel="Создать команду" />
        )}

        {hasPermission && !hasError && (
          <DataTable minWidth={860}>
            <TableHead>
              <TableRow>
                <TableCell>Название</TableCell>
                <TableCell>Участники</TableCell>
                <TableCell>Проекты</TableCell>
                <TableCell>Обновлено</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading && <TableLoadingRows rowCount={4} cellCount={4} />}

              {!isLoading && teams.length === 0 && (
                <TableEmptyState colSpan={4} title="Команды не найдены" description="Создайте новую команду для управления доступами." />
              )}

              {!isLoading &&
                teams.map((team) => (
                  <TableRow key={team.id} hover sx={{ cursor: "pointer" }} onClick={() => setDrawerTeam(team)}>
                    <TableCell><Typography fontWeight={600}>{team.name}</Typography></TableCell>
                    <TableCell>{team.members_count}</TableCell>
                    <TableCell>{team.products_count}</TableCell>
                    <TableCell>{new Date(team.updated_at).toLocaleString("ru-RU")}</TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </DataTable>
        )}
      </Stack>

      <TeamDrawer open={Boolean(drawerTeam)} onClose={() => setDrawerTeam(null)} team={drawerTeam ? { id: drawerTeam.id, name: drawerTeam.name } : undefined} onSaved={load} />
    </AdminV2Shell>
  );
};

export default TeamsPage;
