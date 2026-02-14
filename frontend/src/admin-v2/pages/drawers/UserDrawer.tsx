import {
  Box,
  Divider,
  Drawer,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { Button } from "../../../design-system/components/Button";
import ConfirmDialog from "../../shared/ConfirmDialog";
import useUnsavedChangesPrompt from "../../shared/hooks/useUnsavedChangesPrompt";
import { deleteAdminUserProductRole, getAdminUserAccess, patchAdminUser, putAdminUserTeams, setAdminUserProductRole } from "../../../api/adminUsers";

interface UserDrawerProps {
  open: boolean;
  onClose: () => void;
  user?: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
  onSaved?: () => void;
}

const roleOptions = [
  { value: "owner", label: "Владелец" },
  { value: "admin", label: "Администратор" },
  { value: "security_manager", label: "Менеджер безопасности" },
  { value: "viewer", label: "Наблюдатель" },
];

const UserDrawer = ({ open, onClose, user, onSaved }: UserDrawerProps) => {
  const [role, setRole] = useState(user?.role ?? "viewer");
  const [teamIds, setTeamIds] = useState<string[]>([]);
  const [productRoles, setProductRoles] = useState<Array<{ product_id: string; product_name: string; role: string }>>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmUnsavedOpen, setConfirmUnsavedOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!open || !user) return;
    const load = async () => {
      const access = await getAdminUserAccess(user.id);
      setRole(access.org_role);
      setTeamIds(access.teams.map((team) => team.id));
      setProductRoles(access.product_roles);
    };
    load();
  }, [open, user]);

  const isDirty = useMemo(() => {
    return role !== (user?.role ?? "viewer");
  }, [role, user]);

  useUnsavedChangesPrompt(isDirty);

  const handleRequestClose = () => {
    if (isDirty) {
      setConfirmUnsavedOpen(true);
      return;
    }
    onClose();
  };

  const handleSave = async () => {
    if (!user) return;
    setIsSaving(true);
    try {
      await patchAdminUser(user.id, { org_role: role });
      await putAdminUserTeams(user.id, teamIds);
      onSaved?.();
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <Drawer anchor="right" open={open} onClose={handleRequestClose} PaperProps={{ sx: { width: 460 } }}>
        <Box sx={{ p: 3 }}>
          <Stack spacing={2}>
            <Box>
              <Typography variant="h6" fontWeight={700}>{user?.name ?? "Пользователь"}</Typography>
              <Typography color="text.secondary">{user?.email ?? ""}</Typography>
            </Box>

            <FormControl fullWidth>
              <InputLabel id="org-role-label">Роль в организации</InputLabel>
              <Select
                labelId="org-role-label"
                label="Роль в организации"
                value={role}
                onChange={(event) => setRole(event.target.value)}
              >
                {roleOptions.map((option) => (
                  <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel id="teams-label">Команды</InputLabel>
              <Select
                labelId="teams-label"
                label="Команды"
                multiple
                value={teamIds}
                onChange={(event) => setTeamIds(event.target.value as string[])}
              >
                {teamIds.map((teamId) => (
                  <MenuItem key={teamId} value={teamId}>{teamId}</MenuItem>
                ))}
              </Select>
            </FormControl>

            <Divider />

            <Stack spacing={1.5}>
              <Typography fontWeight={600}>Доступ к проектам</Typography>
              {productRoles.map((item, index) => (
                <Stack key={`${item.product_id}-${index}`} direction="row" spacing={1} alignItems="center">
                  <TextField value={item.product_name} size="small" fullWidth disabled />
                  <FormControl size="small" sx={{ width: 170 }}>
                    <Select
                      value={item.role}
                      onChange={async (event) => {
                        const nextRole = event.target.value;
                        setProductRoles((prev) => prev.map((row, rowIndex) => rowIndex === index ? { ...row, role: nextRole } : row));
                        if (user) {
                          await setAdminUserProductRole(user.id, item.product_id, nextRole);
                        }
                      }}
                    >
                      <MenuItem value="maintainer">Сопровождение</MenuItem>
                      <MenuItem value="engineer">Инженер</MenuItem>
                      <MenuItem value="viewer">Просмотр</MenuItem>
                    </Select>
                  </FormControl>
                  <Button
                    variant="text"
                    color="inherit"
                    onClick={async () => {
                      if (!user) return;
                      await deleteAdminUserProductRole(user.id, item.product_id);
                      setProductRoles((prev) => prev.filter((_, rowIndex) => rowIndex !== index));
                    }}
                  >
                    Удалить
                  </Button>
                </Stack>
              ))}
            </Stack>

            <Divider />

            <Box>
              <Typography fontWeight={600} color="error.main" gutterBottom>Опасная зона</Typography>
              <Typography color="text.secondary" sx={{ mb: 2 }}>
                Подтвердите отключение пользователя. Пользователь будет отключён и потеряет доступ к системе.
              </Typography>
              <Button variant="outlined" color="error" onClick={() => setConfirmOpen(true)}>
                Отключить пользователя
              </Button>
            </Box>

            <Divider />

            <Stack direction="row" spacing={1} justifyContent="flex-end">
              <Button variant="text" color="inherit" onClick={handleRequestClose}>Закрыть</Button>
              <Button variant="contained" onClick={handleSave} loading={isSaving}>Сохранить</Button>
            </Stack>
          </Stack>
        </Box>
      </Drawer>

      <ConfirmDialog
        open={confirmOpen}
        title="Подтвердите отключение пользователя"
        description="Пользователь будет отключён и потеряет доступ к системе"
        confirmLabel="Отключить"
        confirmTone="danger"
        onConfirm={async () => {
          if (user) {
            await patchAdminUser(user.id, { status: "deactivated" });
            onSaved?.();
          }
          setConfirmOpen(false);
          onClose();
        }}
        onClose={() => setConfirmOpen(false)}
      />

      <ConfirmDialog
        open={confirmUnsavedOpen}
        title="Есть несохранённые изменения"
        description="Закрыть окно без сохранения?"
        confirmLabel="Закрыть"
        onConfirm={() => {
          setConfirmUnsavedOpen(false);
          onClose();
        }}
        onClose={() => setConfirmUnsavedOpen(false)}
      />
    </>
  );
};

export default UserDrawer;
