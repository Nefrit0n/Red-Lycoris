import { createContext, useCallback, useContext, useState, ReactNode } from "react";
import { Alert, AlertColor, Snackbar, Stack, IconButton, Typography, Box } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";

interface Notification {
  id: string;
  message: string;
  severity: AlertColor;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface NotificationContextValue {
  notifications: Notification[];
  showNotification: (
    message: string,
    severity?: AlertColor,
    options?: {
      duration?: number;
      action?: Notification["action"];
    }
  ) => void;
  showSuccess: (message: string, options?: { duration?: number; action?: Notification["action"] }) => void;
  showError: (message: string, options?: { duration?: number; action?: Notification["action"] }) => void;
  showWarning: (message: string, options?: { duration?: number; action?: Notification["action"] }) => void;
  showInfo: (message: string, options?: { duration?: number; action?: Notification["action"] }) => void;
  closeNotification: (id: string) => void;
  clearAll: () => void;
}

const NotificationContext = createContext<NotificationContextValue | undefined>(undefined);

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error("useNotification must be used within a NotificationProvider");
  }
  return context;
};

interface NotificationProviderProps {
  children: ReactNode;
  maxNotifications?: number;
}

export const NotificationProvider = ({
  children,
  maxNotifications = 5,
}: NotificationProviderProps) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const closeNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const showNotification = useCallback(
    (
      message: string,
      severity: AlertColor = "info",
      options?: {
        duration?: number;
        action?: Notification["action"];
      }
    ) => {
      const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const notification: Notification = {
        id,
        message,
        severity,
        duration: options?.duration ?? 5000,
        action: options?.action,
      };

      setNotifications((prev) => {
        const updated = [...prev, notification];
        // Keep only the last maxNotifications
        return updated.slice(-maxNotifications);
      });

      // Auto-dismiss after duration
      if (notification.duration && notification.duration > 0) {
        setTimeout(() => {
          closeNotification(id);
        }, notification.duration);
      }
    },
    [closeNotification, maxNotifications]
  );

  const showSuccess = useCallback(
    (message: string, options?: { duration?: number; action?: Notification["action"] }) => {
      showNotification(message, "success", options);
    },
    [showNotification]
  );

  const showError = useCallback(
    (message: string, options?: { duration?: number; action?: Notification["action"] }) => {
      showNotification(message, "error", { ...options, duration: options?.duration ?? 8000 });
    },
    [showNotification]
  );

  const showWarning = useCallback(
    (message: string, options?: { duration?: number; action?: Notification["action"] }) => {
      showNotification(message, "warning", options);
    },
    [showNotification]
  );

  const showInfo = useCallback(
    (message: string, options?: { duration?: number; action?: Notification["action"] }) => {
      showNotification(message, "info", options);
    },
    [showNotification]
  );

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        showNotification,
        showSuccess,
        showError,
        showWarning,
        showInfo,
        closeNotification,
        clearAll,
      }}
    >
      {children}

      {/* Notification Stack */}
      <Box
        sx={{
          position: "fixed",
          bottom: 24,
          right: 24,
          zIndex: 2000,
          display: "flex",
          flexDirection: "column-reverse",
          gap: 1,
          maxWidth: 400,
        }}
      >
        {notifications.map((notification) => (
          <Alert
            key={notification.id}
            severity={notification.severity}
            variant="filled"
            onClose={() => closeNotification(notification.id)}
            action={
              <Stack direction="row" spacing={0.5} alignItems="center">
                {notification.action && (
                  <Typography
                    variant="body2"
                    sx={{
                      cursor: "pointer",
                      textDecoration: "underline",
                      fontWeight: 500,
                    }}
                    onClick={() => {
                      notification.action?.onClick();
                      closeNotification(notification.id);
                    }}
                  >
                    {notification.action.label}
                  </Typography>
                )}
                <IconButton
                  size="small"
                  color="inherit"
                  onClick={() => closeNotification(notification.id)}
                >
                  <CloseIcon fontSize="small" />
                </IconButton>
              </Stack>
            }
            sx={{
              boxShadow: 3,
              animation: "slideIn 0.2s ease-out",
              "@keyframes slideIn": {
                from: {
                  transform: "translateX(100%)",
                  opacity: 0,
                },
                to: {
                  transform: "translateX(0)",
                  opacity: 1,
                },
              },
            }}
          >
            {notification.message}
          </Alert>
        ))}
      </Box>
    </NotificationContext.Provider>
  );
};

export default NotificationProvider;
