import { Alert, AlertTitle, Box } from "@mui/material";
import { Button } from "../../design-system/components/Button";

interface FormErrorBannerProps {
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

const FormErrorBanner = ({
  title = "Не удалось загрузить данные",
  description = "Попробуйте повторить запрос еще раз.",
  actionLabel = "Повторить",
  onAction,
}: FormErrorBannerProps) => (
  <Alert severity="error" sx={{ alignItems: "center" }}>
    <AlertTitle>{title}</AlertTitle>
    {description}
    {actionLabel && (
      <Box sx={{ mt: 1 }}>
        <Button variant="text" color="inherit" onClick={onAction}>
          {actionLabel}
        </Button>
      </Box>
    )}
  </Alert>
);

export default FormErrorBanner;
