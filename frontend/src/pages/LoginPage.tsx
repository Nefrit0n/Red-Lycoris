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
  const [loginValue, setLoginValue] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loginError, setLoginError] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setLoginError(false);

    if (!loginValue || !password) {
      setLoginError(!loginValue);
      setError("Заполните логин и пароль");
      return;
    }

    setLoading(true);
    try {
      const result = await login({ login: loginValue, password });
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
            label="Логин, email или домен"
            type="text"
            value={loginValue}
            onChange={(event) => setLoginValue(event.target.value)}
            margin="normal"
            fullWidth
            required
            autoComplete="username"
            error={loginError}
            helperText={loginError ? "Введите логин" : " "}
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
