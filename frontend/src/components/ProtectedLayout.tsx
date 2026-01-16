import { Box } from "@mui/material";
import { Navigate, Outlet } from "react-router-dom";
import { getToken } from "../api/http";
import TopBar from "./TopBar";

const ProtectedLayout = () => {
  const token = getToken();

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return (
    <Box minHeight="100vh" display="flex" flexDirection="column">
      <TopBar />
      <Box flex={1} bgcolor="background.default">
        <Outlet />
      </Box>
    </Box>
  );
};

export default ProtectedLayout;
