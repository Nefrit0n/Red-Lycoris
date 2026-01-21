import {
  Box,
  CircularProgress,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
} from "@mui/material";
import {
  FiberNew as FiberNewIcon,
  Visibility as VisibilityIcon,
  CheckCircleOutline as CheckCircleOutlineIcon,
  Verified as VerifiedIcon,
  Block as BlockIcon,
  RemoveCircleOutline as RemoveCircleOutlineIcon,
  ThumbUpAltOutlined as ThumbUpAltOutlinedIcon,
  ContentCopy as ContentCopyIcon,
} from "@mui/icons-material";
import { useState } from "react";
import { FindingStatus } from "../types/findings";
import { updateFindingStatus } from "../clients/findingsClient";

interface InlineStatusSelectProps {
  findingId: string;
  currentStatus: FindingStatus;
  onStatusChange?: (newStatus: FindingStatus) => void;
  disabled?: boolean;
}

const statusConfig: Record<
  FindingStatus,
  { icon: React.ReactNode; label: string; color: string; bgcolor: string; borderColor?: string }
> = {
  new: {
    icon: <FiberNewIcon sx={{ fontSize: 16 }} />,
    label: "New",
    bgcolor: "rgba(33, 150, 243, 0.15)",
    color: "#64b5f6",
    borderColor: "rgba(33, 150, 243, 0.5)",
  },
  under_review: {
    icon: <VisibilityIcon sx={{ fontSize: 16 }} />,
    label: "Under Review",
    bgcolor: "rgba(255, 152, 0, 0.12)",
    color: "#ffb74d",
    borderColor: "rgba(255, 152, 0, 0.4)",
  },
  confirmed: {
    icon: <CheckCircleOutlineIcon sx={{ fontSize: 16 }} />,
    label: "Confirmed",
    bgcolor: "rgba(244, 67, 54, 0.12)",
    color: "#ef5350",
    borderColor: "rgba(244, 67, 54, 0.4)",
  },
  mitigated: {
    icon: <VerifiedIcon sx={{ fontSize: 16 }} />,
    label: "Mitigated",
    bgcolor: "rgba(76, 175, 80, 0.12)",
    color: "#81c784",
    borderColor: "rgba(76, 175, 80, 0.4)",
  },
  false_positive: {
    icon: <BlockIcon sx={{ fontSize: 16 }} />,
    label: "False Positive",
    bgcolor: "rgba(158, 158, 158, 0.1)",
    color: "#9e9e9e",
    borderColor: "rgba(158, 158, 158, 0.3)",
  },
  out_of_scope: {
    icon: <RemoveCircleOutlineIcon sx={{ fontSize: 16 }} />,
    label: "Out of Scope",
    bgcolor: "rgba(158, 158, 158, 0.1)",
    color: "#9e9e9e",
    borderColor: "rgba(158, 158, 158, 0.3)",
  },
  risk_accepted: {
    icon: <ThumbUpAltOutlinedIcon sx={{ fontSize: 16 }} />,
    label: "Risk Accepted",
    bgcolor: "rgba(255, 193, 7, 0.1)",
    color: "#ffd54f",
    borderColor: "rgba(255, 193, 7, 0.3)",
  },
  duplicate: {
    icon: <ContentCopyIcon sx={{ fontSize: 16 }} />,
    label: "Duplicate",
    bgcolor: "rgba(158, 158, 158, 0.1)",
    color: "#9e9e9e",
    borderColor: "rgba(158, 158, 158, 0.3)",
  },
};

const statusOrder: FindingStatus[] = [
  "new",
  "under_review",
  "confirmed",
  "mitigated",
  "false_positive",
  "out_of_scope",
  "risk_accepted",
  "duplicate",
];

const InlineStatusSelect = ({
  findingId,
  currentStatus,
  onStatusChange,
  disabled = false,
}: InlineStatusSelectProps) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<FindingStatus>(currentStatus);

  const config = statusConfig[status];

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    if (!disabled && !loading) {
      setAnchorEl(event.currentTarget);
    }
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleSelectStatus = async (newStatus: FindingStatus) => {
    if (newStatus === status) {
      handleClose();
      return;
    }

    setLoading(true);
    handleClose();

    try {
      await updateFindingStatus(findingId, newStatus);
      setStatus(newStatus);
      onStatusChange?.(newStatus);
    } catch (error) {
      console.error("Failed to update status:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Box
        onClick={handleClick}
        sx={{
          display: "inline-flex",
          alignItems: "center",
          gap: 0.5,
          px: 1.25,
          py: 0.5,
          borderRadius: "16px",
          fontWeight: 500,
          fontSize: "0.75rem",
          color: config.color,
          bgcolor: config.bgcolor,
          border: config.borderColor ? `1px solid ${config.borderColor}` : "none",
          cursor: disabled || loading ? "default" : "pointer",
          opacity: loading ? 0.7 : 1,
          transition: "all 0.2s ease",
          "&:hover": {
            transform: disabled || loading ? "none" : "scale(1.02)",
            boxShadow: disabled || loading ? "none" : `0 0 0 2px ${config.borderColor}`,
          },
          "& .MuiSvgIcon-root": {
            color: config.color,
          },
        }}
      >
        {loading ? (
          <CircularProgress size={14} sx={{ color: config.color }} />
        ) : (
          config.icon
        )}
        {config.label}
      </Box>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleClose}
        onClick={(e) => e.stopPropagation()}
        PaperProps={{
          sx: { minWidth: 180 },
        }}
        anchorOrigin={{
          vertical: "bottom",
          horizontal: "center",
        }}
        transformOrigin={{
          vertical: "top",
          horizontal: "center",
        }}
      >
        {statusOrder.map((s) => {
          const cfg = statusConfig[s];
          const isSelected = s === status;

          return (
            <MenuItem
              key={s}
              onClick={() => handleSelectStatus(s)}
              selected={isSelected}
              sx={{
                py: 1,
                "&.Mui-selected": {
                  bgcolor: cfg.bgcolor,
                },
              }}
            >
              <ListItemIcon sx={{ minWidth: 32, color: cfg.color }}>
                {cfg.icon}
              </ListItemIcon>
              <ListItemText
                primary={cfg.label}
                primaryTypographyProps={{
                  sx: { color: isSelected ? cfg.color : "text.primary" },
                }}
              />
            </MenuItem>
          );
        })}
      </Menu>
    </>
  );
};

export default InlineStatusSelect;
