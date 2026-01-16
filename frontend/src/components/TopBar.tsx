import {
  AppBar,
  Box,
  Button,
  Stack,
  Toolbar,
  Typography,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import { logout } from "../api/auth";

interface TopBarProps {
  onLoggedOut?: () => void;
}

const TopBar = ({ onLoggedOut }: TopBarProps) => {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    if (onLoggedOut) {
      onLoggedOut();
    }
    navigate("/login", { replace: true });
  };

  return (
    <AppBar position="static" color="transparent" elevation={0} sx={{ borderBottom: "1px solid", borderColor: "divider" }}>
      <Toolbar sx={{ display: "flex", justifyContent: "space-between" }}>
        <Box>
          <Typography variant="h6" component="div">
            Lotus Warden
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Управление находками уязвимостей
          </Typography>
        </Box>
        <Stack direction="row" spacing={2}>
          <Button variant="text" onClick={() => navigate("/findings")}>Findings</Button>
          <Button variant="text" onClick={() => navigate("/products")}>Products</Button>
          <Button variant="text" onClick={() => navigate("/imports")}>Imports</Button>
          <Button variant="text" onClick={() => navigate("/scans/upload")}>Upload Scan</Button>
          <Button variant="outlined" onClick={handleLogout} aria-label="Выйти из системы">
            Выйти
          </Button>
        </Stack>
      </Toolbar>
    </AppBar>
  );
};

export default TopBar;
