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
import { login } from "../api/auth";

const LoginPage = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState(false);

  const isEmailValid = (value: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setEmailError(false);

    if (!email || !password) {
      setError("Заполните email и пароль");
      return;
    }
    if (!isEmailValid(email)) {
      setEmailError(true);
      setError("Введите корректный email");
      return;
    }

    setLoading(true);
    try {
      const result = await login({ email, password });
      if (result.needsPasswordChange) {
        navigate("/change_password", { replace: true });
      } else {
        navigate("/dashboard", { replace: true });
      }
    } catch (loginError) {
      if (loginError instanceof Error) {
        setError(loginError.message);
      } else {
        setError("Не удалось выполнить вход");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="sm" sx={{ py: { xs: 6, md: 10 } }}>
      <Paper elevation={0} sx={{ p: { xs: 3, md: 5 }, borderRadius: 3, border: "1px solid", borderColor: "divider" }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Вход в систему
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
          Используйте корпоративный аккаунт для доступа к находкам и отчетам.
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        <Box component="form" onSubmit={handleSubmit} noValidate>
          <TextField
            label="Email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            margin="normal"
            fullWidth
            required
            autoComplete="email"
            error={emailError}
            helperText={emailError ? "Некорректный формат email" : " "}
          />
          <TextField
            label="Пароль"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            margin="normal"
            fullWidth
            required
            autoComplete="current-password"
          />

          <Button
            type="submit"
            variant="contained"
            fullWidth
            sx={{ mt: 3 }}
            disabled={loading}
          >
            {loading ? <CircularProgress size={24} color="inherit" /> : "Войти"}
          </Button>
        </Box>
      </Paper>
    </Container>
  );
};

export default LoginPage;
