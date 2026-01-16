import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  Paper,
  TextField,
  Typography,
} from "@mui/material";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { changePassword } from "../api/auth";

const MIN_PASSWORD_LENGTH = 8;

const ChangePasswordPage = () => {
  const navigate = useNavigate();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newPasswordError, setNewPasswordError] = useState(false);
  const [confirmPasswordError, setConfirmPasswordError] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setNewPasswordError(false);
    setConfirmPasswordError(false);

    if (!newPassword || !confirmPassword) {
      setError("Введите новый пароль и подтверждение");
      setNewPasswordError(!newPassword);
      setConfirmPasswordError(!confirmPassword);
      return;
    }

    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setNewPasswordError(true);
      setError(`Минимальная длина пароля — ${MIN_PASSWORD_LENGTH} символов`);
      return;
    }

    if (newPassword !== confirmPassword) {
      setConfirmPasswordError(true);
      setError("Пароли не совпадают");
      return;
    }

    setLoading(true);
    try {
      await changePassword({
        newPassword,
        newPasswordConfirm: confirmPassword,
      });
      navigate("/dashboard", { replace: true });
    } catch (submitError) {
      if (submitError instanceof Error) {
        setError(submitError.message);
      } else {
        setError("Не удалось обновить пароль");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="sm" sx={{ py: { xs: 6, md: 10 } }}>
      <Paper elevation={0} sx={{ p: { xs: 3, md: 5 }, borderRadius: 3, border: "1px solid", borderColor: "divider" }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Смена пароля
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
          Для продолжения работы замените пароль по умолчанию.
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        <Box component="form" onSubmit={handleSubmit} noValidate>
          <TextField
            label="Новый пароль"
            type="password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            margin="normal"
            fullWidth
            required
            autoComplete="new-password"
            error={newPasswordError}
            helperText={newPasswordError ? `Не менее ${MIN_PASSWORD_LENGTH} символов` : " "}
          />
          <TextField
            label="Подтвердите пароль"
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            margin="normal"
            fullWidth
            required
            autoComplete="new-password"
            error={confirmPasswordError}
            helperText={confirmPasswordError ? "Пароли должны совпадать" : " "}
          />

          <Button
            type="submit"
            variant="contained"
            fullWidth
            sx={{ mt: 3 }}
            disabled={loading}
          >
            {loading ? <CircularProgress size={24} color="inherit" /> : "Обновить пароль"}
          </Button>
        </Box>
      </Paper>
    </Container>
  );
};

export default ChangePasswordPage;
