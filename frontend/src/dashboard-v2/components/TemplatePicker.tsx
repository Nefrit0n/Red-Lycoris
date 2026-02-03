import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from "@mui/material";
import { GlassCard } from "../../design-system";
import { bordersDark, radius } from "../../design-system/tokens";
import type { DashboardTemplate } from "../types";

interface TemplatePickerProps {
  open: boolean;
  templates: DashboardTemplate[];
  selectedTemplateId: string;
  onClose: () => void;
  onApply: (templateId: string) => void;
}

const TemplatePicker = ({
  open,
  templates,
  selectedTemplateId,
  onClose,
  onApply,
}: TemplatePickerProps) => {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Choose a template</DialogTitle>
      <DialogContent>
        <Stack spacing={2} mt={1}>
          {templates.map((template) => (
            <GlassCard
              key={template.id}
              variant="subtle"
              padding="comfortable"
              sx={{
                border: template.id === selectedTemplateId ? bordersDark.lotus : bordersDark.default,
                borderRadius: radius.card,
                cursor: "pointer",
                transition: "border-color 0.2s ease, transform 0.2s ease",
                "&:hover": {
                  border: bordersDark.interactive,
                  transform: "translateY(-2px)",
                },
              }}
              onClick={() => onApply(template.id)}
            >
              <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ md: "center" }}>
                <Box flex={1}>
                  <Typography variant="subtitle1">{template.role}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {template.description}
                  </Typography>
                </Box>
                <Typography variant="caption" color="text.secondary">
                  {template.layout.length} widgets
                </Typography>
              </Stack>
            </GlassCard>
          ))}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

export default TemplatePicker;
