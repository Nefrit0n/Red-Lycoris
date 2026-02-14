import {
  Box,
  Checkbox,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
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
import UserDrawer from "./drawers/UserDrawer";
import { bulkAdminUsers, inviteAdminUser, listAdminUsers, type AdminUserItem } from "../../api/adminUsers";
import { Button } from "../../design-system/components/Button";

const roleLabel: Record<string, string> = {
  owner: "Владелец",
  admin: "Администратор",
  security_manager: "Менеджер безопасности",
  viewer: "Наблюдатель",
};

const statusLabel: Record<string, string> = {
  active: "Активен",
  deactivated: "Отключён",
  invited: "Приглашён",
};

const UsersPage = () => {
  const hasPermission = true;
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [users, setUsers] = useState<AdminUserItem[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [drawerUser, setDrawerUser] = useState<AdminUserItem | null>(null);

  const loadUsers = async () => {
    setIsLoading(true);
    setHasError(false);
    try {
      const response = await listAdminUsers({ q: search, role: roleFilter, status: statusFilter, limit: 50 });
      setUsers(response.items);
    } catch {
      setHasError(true);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, [search, roleFilter, statusFilter]);

  const filteredUsers = useMemo(() => users, [users]);

  const toggleSelectAll = (checked: boolean) => {
    setSelected(checked ? filteredUsers.map((user) => user.id) : []);
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const executeBulk = async (action: "set_org_role" | "add_to_team" | "deactivate") => {
    if (selected.length === 0) return;
    const params: Record<string, unknown> = {};
    if (action === "set_org_role") params.org_role = "viewer";
    if (action === "add_to_team") params.team_id = "00000000-0000-0000-0000-000000000000";
    await bulkAdminUsers({ user_ids: selected, action, params });
    setSelected([]);
    await loadUsers();
  };

  return (
    <AdminV2Shell
      title="Пользователи"
      primaryAction={{
        label: "Пригласить пользователя",
        onClick: async () => {
          const email = window.prompt("Введите email пользователя");
          if (!email) return;
          try {
            await inviteAdminUser({ email, org_role: "viewer" });
            await loadUsers();
          } catch {
            window.alert("Пользователь уже состоит в организации или приглашение уже отправлено.");
          }
        },
      }}
    >
      <Stack spacing={3}>
        {!hasPermission && (
          <EmptyState
            title="У вас нет прав для просмотра этого раздела."
            description="Если доступ нужен для работы, обратитесь к владельцу организации."
          />
        )}

        {hasPermission && hasError && <FormErrorBanner onAction={loadUsers} />}

        {hasPermission && !hasError && filteredUsers.length === 0 && !isLoading && (
          <EmptyState
            title="Пока здесь пусто."
            description="Пригласите коллег, чтобы распределять доступ."
            actionLabel="Пригласить пользователя"
          />
        )}

        {hasPermission && !hasError && (
          <Stack spacing={2}>
            <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
              <TextField
                label="Поиск по имени или email"
                placeholder="Поиск по имени или email"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                fullWidth
              />
              <FormControl sx={{ minWidth: 220 }}>
                <InputLabel id="role-filter-label">Роль</InputLabel>
                <Select labelId="role-filter-label" label="Роль" value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}>
                  <MenuItem value="">Все роли</MenuItem>
                  <MenuItem value="owner">Владелец</MenuItem>
                  <MenuItem value="admin">Администратор</MenuItem>
                  <MenuItem value="security_manager">Менеджер безопасности</MenuItem>
                  <MenuItem value="viewer">Наблюдатель</MenuItem>
                </Select>
              </FormControl>
              <FormControl sx={{ minWidth: 200 }}>
                <InputLabel id="status-filter-label">Статус</InputLabel>
                <Select labelId="status-filter-label" label="Статус" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                  <MenuItem value="">Все статусы</MenuItem>
                  <MenuItem value="active">Активен</MenuItem>
                  <MenuItem value="deactivated">Отключён</MenuItem>
                  <MenuItem value="invited">Приглашён</MenuItem>
                </Select>
              </FormControl>
            </Stack>

            {selected.length > 0 && (
              <Box sx={{ p: 2, borderRadius: 2, border: "1px solid", borderColor: "divider", backgroundColor: "background.paper" }}>
                <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems="center">
                  <Typography fontWeight={600}>Выбрано: {selected.length}</Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap">
                    <Button variant="outlined" onClick={() => executeBulk("add_to_team")}>Добавить в команду…</Button>
                    <Button variant="outlined" onClick={() => executeBulk("set_org_role")}>Изменить роль…</Button>
                    <Button variant="outlined" color="error" onClick={() => executeBulk("deactivate")}>Отключить…</Button>
                  </Stack>
                </Stack>
              </Box>
            )}

            <DataTable minWidth={980}>
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox">
                    <Checkbox
                      checked={selected.length === filteredUsers.length && filteredUsers.length > 0}
                      indeterminate={selected.length > 0 && selected.length < filteredUsers.length}
                      onChange={(event) => toggleSelectAll(event.target.checked)}
                    />
                  </TableCell>
                  <TableCell>Пользователь</TableCell>
                  <TableCell>Роль в организации</TableCell>
                  <TableCell>Команды</TableCell>
                  <TableCell>Доступ к проектам</TableCell>
                  <TableCell>Последний вход</TableCell>
                  <TableCell>Статус</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {isLoading && <TableLoadingRows rowCount={5} cellCount={7} checkbox />}

                {!isLoading && filteredUsers.length === 0 && (
                  <TableEmptyState colSpan={7} title="Пользователи не найдены" description="Попробуйте изменить фильтры." />
                )}

                {!isLoading &&
                  filteredUsers.map((user) => (
                    <TableRow key={user.id} hover sx={{ cursor: "pointer" }} onClick={() => setDrawerUser(user)}>
                      <TableCell padding="checkbox" onClick={(event) => event.stopPropagation()}>
                        <Checkbox checked={selected.includes(user.id)} onChange={() => toggleSelect(user.id)} />
                      </TableCell>
                      <TableCell>
                        <Stack spacing={0.5}>
                          <Typography fontWeight={600}>{user.full_name || "Без имени"}</Typography>
                          <Typography variant="caption" color="text.secondary">{user.email}</Typography>
                        </Stack>
                      </TableCell>
                      <TableCell>{roleLabel[user.org_role] ?? user.org_role}</TableCell>
                      <TableCell>{user.teams_count}</TableCell>
                      <TableCell>{user.products_count}</TableCell>
                      <TableCell>{user.last_login_at ? new Date(user.last_login_at).toLocaleString("ru-RU") : "—"}</TableCell>
                      <TableCell>
                        <TableChip label={statusLabel[user.status] ?? user.status} color={user.status === "active" ? "success" : "default"} />
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </DataTable>
          </Stack>
        )}
      </Stack>

      <UserDrawer
        open={Boolean(drawerUser)}
        user={drawerUser ? { id: drawerUser.id, name: drawerUser.full_name || "Без имени", email: drawerUser.email, role: drawerUser.org_role } : undefined}
        onClose={() => setDrawerUser(null)}
        onSaved={loadUsers}
      />
    </AdminV2Shell>
  );
};

export default UsersPage;
