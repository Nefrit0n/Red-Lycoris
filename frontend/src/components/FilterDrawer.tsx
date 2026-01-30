import {
  Box,
  Button,
  Drawer,
  IconButton,
  Stack,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import { ReactNode } from "react";

interface FilterDrawerProps {
  open: boolean;
  onClose: () => void;
  onReset: () => void;
  width: number | string;
  title?: string;
  footerText?: string;
  children: ReactNode;
}

const FilterDrawer = ({
  open,
  onClose,
  onReset,
  width,
  title = "Фильтры",
  footerText = "Фильтры применяются автоматически",
  children,
}: FilterDrawerProps) => (
  <Drawer
    anchor="right"
    open={open}
    onClose={onClose}
    PaperProps={{
      sx: {
        width,
        maxWidth: "100vw",
        borderTopLeftRadius: { md: 16, xs: 0 },
        borderBottomLeftRadius: { md: 16, xs: 0 },
        display: "flex",
        flexDirection: "column",
      },
    }}
  >
    <Box
      sx={{
        p: 2,
        borderBottom: "1px solid",
        borderColor: "divider",
      }}
    >
      <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
          {title}
        </Typography>
        <Stack direction="row" gap={1} alignItems="center">
          <Button
            size="small"
            variant="outlined"
            startIcon={<RestartAltIcon />}
            onClick={onReset}
          >
            Сбросить
          </Button>
          <IconButton onClick={onClose} aria-label="Закрыть">
            <CloseIcon />
          </IconButton>
        </Stack>
      </Stack>
    </Box>

    <Box sx={{ p: 2, flex: "1 1 auto", overflowY: "auto" }}>{children}</Box>

    <Box
      sx={{
        p: 2,
        borderTop: "1px solid",
        borderColor: "divider",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 2,
      }}
    >
      <Typography variant="caption" color="text.secondary">
        {footerText}
      </Typography>
      <Button variant="contained" size="small" onClick={onClose}>
        Готово
      </Button>
    </Box>
  </Drawer>
);

export default FilterDrawer;
