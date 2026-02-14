import {
  Box,
  Divider,
  Drawer,
  Stack,
  Typography,
} from "@mui/material";
import { Button } from "../../../design-system/components/Button";

interface AuditEventDrawerProps {
  open: boolean;
  onClose: () => void;
  event?: {
    time: string;
    actor: string;
    action: string;
    target: string;
    changes: string[];
  };
}

const AuditEventDrawer = ({ open, onClose, event }: AuditEventDrawerProps) => (
  <Drawer anchor="right" open={open} onClose={onClose} PaperProps={{ sx: { width: 420 } }}>
    <Box sx={{ p: 3 }}>
      <Stack spacing={2}>
        <Box>
          <Typography variant="h6" fontWeight={700}>
            Детали события
          </Typography>
          <Typography color="text.secondary">{event?.time ?? ""}</Typography>
        </Box>

        <Divider />

        <Stack spacing={1}>
          <Typography fontWeight={600}>Кто</Typography>
          <Typography color="text.secondary">{event?.actor}</Typography>
        </Stack>

        <Stack spacing={1}>
          <Typography fontWeight={600}>Действие</Typography>
          <Typography color="text.secondary">{event?.action}</Typography>
        </Stack>

        <Stack spacing={1}>
          <Typography fontWeight={600}>Объект</Typography>
          <Typography color="text.secondary">{event?.target}</Typography>
        </Stack>

        <Divider />

        <Stack spacing={1}>
          <Typography fontWeight={600}>Изменения</Typography>
          {event?.changes?.map((change) => (
            <Typography key={change} color="text.secondary">
              • {change}
            </Typography>
          ))}
        </Stack>

        <Stack direction="row" spacing={1} justifyContent="flex-end">
          <Button variant="text" color="inherit" onClick={onClose}>
            Закрыть
          </Button>
        </Stack>
      </Stack>
    </Box>
  </Drawer>
);

export default AuditEventDrawer;
