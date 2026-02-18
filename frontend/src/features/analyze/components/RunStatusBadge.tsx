import { Chip } from "@mui/material";
import type { ComponentProps } from "react";

type ChipColor = ComponentProps<typeof Chip>["color"];

const STATUS_CONFIG: Record<string, { label: string; color: ChipColor }> = {
  queued: { label: "В очереди", color: "warning" },
  processing: { label: "В работе", color: "info" },
  succeeded: { label: "Успешно", color: "success" },
  failed: { label: "Ошибка", color: "error" },
  pending: { label: "Ожидание", color: "default" },
  running: { label: "Выполняется", color: "info" },
};

interface RunStatusBadgeProps {
  status: string;
  size?: "small" | "medium";
  animate?: boolean;
}

const RunStatusBadge = ({ status, size = "small", animate = true }: RunStatusBadgeProps) => {
  const cfg = STATUS_CONFIG[status] ?? { label: status, color: "default" as ChipColor };
  const isProcessing = status === "processing" || status === "running";

  return (
    <Chip
      label={cfg.label}
      color={cfg.color}
      size={size}
      variant="filled"
      sx={{
        ...(animate && isProcessing && {
          animation: "runStatusPulse 1.5s ease-in-out infinite",
          "@keyframes runStatusPulse": {
            "0%, 100%": { opacity: 1 },
            "50%": { opacity: 0.6 },
          },
        }),
      }}
    />
  );
};

export default RunStatusBadge;
