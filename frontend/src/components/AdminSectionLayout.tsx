import { Alert, Box, Container, Typography } from "@mui/material";
import { ReactNode } from "react";
import { getCurrentUser, isAdminUser } from "../api/auth";

interface AdminSectionLayoutProps {
  title: string;
  description?: string;
  children: ReactNode;
}

const AdminSectionLayout = ({
  title,
  description,
  children,
}: AdminSectionLayoutProps) => {
  const user = getCurrentUser();
  if (!isAdminUser(user)) {
    return (
      <Container maxWidth="lg" sx={{ py: { xs: 4, md: 6 } }}>
        <Alert severity="error">Доступ запрещён.</Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 4, md: 6 } }}>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          {title}
        </Typography>
        {description && (
          <Typography variant="body1" color="text.secondary">
            {description}
          </Typography>
        )}
      </Box>
      {children}
    </Container>
  );
};

export default AdminSectionLayout;
