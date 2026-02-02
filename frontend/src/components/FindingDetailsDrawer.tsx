/**
 * FindingDetailsDrawer - RED LYCORIS styled sidebar
 *
 * Minimalist design with glass effect header and clean layout.
 */

import {
  Box,
  Drawer,
  IconButton,
  Stack,
  Tooltip,
  Typography,
  alpha,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import RefreshIcon from "@mui/icons-material/Refresh";
import { useMemo, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import { FindingDetailContent, FindingDetailErrorBoundary } from "../pages/FindingDetail";
import { buildFindingLink } from "../utils/findingFormatters";
import { primitives } from "../design-system/tokens/colors";

type Props = {
  /** ID of selected finding. null/"" => drawer closed */
  findingId: string | null;
  /** Return path for "open in new page" button */
  returnTo: string;
  onClose: () => void;
};

export default function FindingDetailsDrawer({ findingId, returnTo, onClose }: Props) {
  const open = Boolean(findingId);
  const [refreshKey, setRefreshKey] = useState(0);

  const drawerWidth = useMemo(
    () => ({
      xs: "100vw",
      sm: 520,
      md: 600,
    }),
    []
  );

  const openInFullPageHref = findingId ? buildFindingLink(findingId, returnTo) : "#";

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      variant="temporary"
      ModalProps={{ keepMounted: true }}
      PaperProps={{
        sx: {
          width: drawerWidth,
          maxWidth: "100vw",
          bgcolor: primitives.night[800],
          borderLeft: "1px solid",
          borderColor: primitives.night[600],
          // Subtle gradient at top
          backgroundImage: `linear-gradient(180deg, ${alpha(primitives.lotus[500], 0.03)} 0%, transparent 200px)`,
        },
      }}
    >
      {/* Header */}
      <Box
        sx={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          bgcolor: alpha(primitives.night[800], 0.95),
          backdropFilter: "blur(8px)",
          borderBottom: "1px solid",
          borderColor: primitives.night[600],
          px: 2.5,
          py: 2,
        }}
      >
        <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography
              variant="subtitle1"
              sx={{
                fontWeight: 600,
                color: primitives.night[50],
                letterSpacing: "-0.01em",
              }}
            >
              Finding Details
            </Typography>
            {findingId && (
              <Typography
                variant="caption"
                sx={{
                  color: primitives.night[400],
                  fontFamily: "monospace",
                  fontSize: "0.7rem",
                  display: "block",
                  mt: 0.25,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
                title={findingId}
              >
                {findingId}
              </Typography>
            )}
          </Box>

          <Stack direction="row" spacing={0.5} alignItems="center">
            <Tooltip title="Open in new page">
              <IconButton
                component={RouterLink}
                to={openInFullPageHref}
                size="small"
                aria-label="Open in new page"
                disabled={!findingId}
                sx={{
                  color: primitives.night[300],
                  "&:hover": {
                    color: primitives.lotus[400],
                    bgcolor: alpha(primitives.lotus[500], 0.1),
                  },
                }}
              >
                <OpenInNewIcon fontSize="small" />
              </IconButton>
            </Tooltip>

            <Tooltip title="Refresh">
              <IconButton
                size="small"
                aria-label="Refresh"
                onClick={() => setRefreshKey((k) => k + 1)}
                disabled={!findingId}
                sx={{
                  color: primitives.night[300],
                  "&:hover": {
                    color: primitives.night[100],
                    bgcolor: alpha(primitives.night[500], 0.3),
                  },
                }}
              >
                <RefreshIcon fontSize="small" />
              </IconButton>
            </Tooltip>

            <Tooltip title="Close">
              <IconButton
                onClick={onClose}
                size="small"
                aria-label="Close"
                sx={{
                  color: primitives.night[300],
                  "&:hover": {
                    color: primitives.night[100],
                    bgcolor: alpha(primitives.night[500], 0.3),
                  },
                }}
              >
                <CloseIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
        </Stack>
      </Box>

      {/* Body */}
      <Box
        sx={{
          p: 2.5,
          overflow: "auto",
          flex: 1,
          "& .MuiTypography-root": {
            color: primitives.night[100],
          },
          "& .MuiTypography-body2": {
            color: primitives.night[200],
          },
          "& .MuiTypography-caption": {
            color: primitives.night[300],
          },
        }}
      >
        {findingId ? (
          <FindingDetailErrorBoundary>
            <FindingDetailContent
              key={`${findingId}-${refreshKey}`}
              id={findingId}
              compact
              returnTo={returnTo}
              onClose={onClose}
            />
          </FindingDetailErrorBoundary>
        ) : (
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              minHeight: 200,
            }}
          >
            <Typography variant="body2" color="text.secondary">
              Select a finding to view details.
            </Typography>
          </Box>
        )}
      </Box>
    </Drawer>
  );
}
