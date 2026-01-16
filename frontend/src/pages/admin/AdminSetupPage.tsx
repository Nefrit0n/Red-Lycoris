import {
  Alert,
  Paper,
  Step,
  StepLabel,
  Stepper,
  Typography,
} from "@mui/material";
import AdminSectionLayout from "../../components/AdminSectionLayout";

const setupSteps = [
  "Смена root пароля",
  "Создание первого продукта",
  "Создание admin пользователя (опционально)",
  "Базовые маппинги",
  "Завершение",
];

const AdminSetupPage = () => {
  return (
    <AdminSectionLayout
      title="System / Setup"
      description="Мастер первичной настройки и системные параметры."
    >
      <Alert severity="info" sx={{ mb: 3 }}>
        При незавершённой настройке доступ к остальным разделам может быть
        ограничен.
      </Alert>

      <Paper variant="outlined" sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          First-run wizard
        </Typography>
        <Stepper orientation="vertical">
          {setupSteps.map((label) => (
            <Step key={label} active>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>
      </Paper>
    </AdminSectionLayout>
  );
};

export default AdminSetupPage;
