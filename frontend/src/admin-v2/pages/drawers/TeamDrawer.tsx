import {
  Box,
  Drawer,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import { useEffect, useState } from "react";
import { Button } from "../../../design-system/components/Button";
import { getTeam, listAdminProducts, patchTeam, putProductTeamRole, putTeamMembers } from "../../../api/adminTeamsProjects";

interface TeamDrawerProps {
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
  team?: {
    id: string;
    name: string;
  };
}

const TeamDrawer = ({ open, onClose, team, onSaved }: TeamDrawerProps) => {
  const [tab, setTab] = useState(0);
  const [name, setName] = useState(team?.name ?? "");
  const [description, setDescription] = useState("");
  const [members, setMembers] = useState<Array<{ user_id: string; email: string; full_name: string | null }>>([]);
  const [products, setProducts] = useState<Array<{ product_id: string; product_name: string; role: string }>>([]);

  useEffect(() => {
    if (!open || !team) return;
    const load = async () => {
      const detail = await getTeam(team.id);
      setName(detail.name);
      setDescription(detail.description ?? "");
      setMembers(detail.members);
      setProducts(detail.product_roles);
    };
    load();
  }, [open, team]);

  const save = async () => {
    if (!team) return;
    await patchTeam(team.id, { name, description });
    await putTeamMembers(team.id, members.map((member) => member.user_id));
    onSaved?.();
    onClose();
  };

  return (
    <Drawer anchor="right" open={open} onClose={onClose} PaperProps={{ sx: { width: 500 } }}>
      <Box sx={{ p: 3 }}>
        <Stack spacing={2}>
          <Typography variant="h6" fontWeight={700}>Команда</Typography>

          <TextField label="Название" value={name} onChange={(event) => setName(event.target.value)} fullWidth />
          <TextField label="Описание" value={description} onChange={(event) => setDescription(event.target.value)} fullWidth multiline minRows={2} />

          <Tabs value={tab} onChange={(_, value) => setTab(value)}>
            <Tab label="Участники" />
            <Tab label="Проекты" />
          </Tabs>

          {tab === 0 && (
            <Stack spacing={1.5}>
              {members.map((member) => (
                <Stack key={member.user_id} direction="row" spacing={1} alignItems="center">
                  <TextField value={member.full_name ?? member.email} size="small" fullWidth disabled />
                  <Button variant="text" color="inherit" onClick={() => setMembers(members.filter((item) => item.user_id !== member.user_id))}>Удалить</Button>
                </Stack>
              ))}
            </Stack>
          )}

          {tab === 1 && (
            <Stack spacing={1.5}>
              {products.map((product) => (
                <Stack key={product.product_id} direction="row" spacing={1} alignItems="center">
                  <TextField value={product.product_name} size="small" fullWidth disabled />
                  <TextField value={product.role} size="small" sx={{ width: 160 }} disabled />
                </Stack>
              ))}
              <Button variant="outlined" onClick={async () => {
                if (!team) return;
                const list = await listAdminProducts();
                const product = list[0];
                if (!product) return;
                await putProductTeamRole(product.id, team.id, "viewer");
                const detail = await getTeam(team.id);
                setProducts(detail.product_roles);
              }}>
                Назначить проект
              </Button>
            </Stack>
          )}

          <Stack direction="row" spacing={1} justifyContent="flex-end">
            <Button variant="text" color="inherit" onClick={onClose}>Закрыть</Button>
            <Button variant="contained" onClick={save}>Сохранить</Button>
          </Stack>
        </Stack>
      </Box>
    </Drawer>
  );
};

export default TeamDrawer;
