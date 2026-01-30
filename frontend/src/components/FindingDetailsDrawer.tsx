import {
    Box,
    Divider,
    Drawer,
    IconButton,
    Stack,
    Tooltip,
    Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import RefreshIcon from "@mui/icons-material/Refresh";
import { useMemo, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import { FindingDetailContent, FindingDetailErrorBoundary } from "../pages/FindingDetail";
import { buildFindingLink } from "../utils/findingFormatters";

type Props = {
    /** id выбранной находки. null/"" => панель закрыта */
    findingId: string | null;
    /** путь списка (чтобы кнопка “открыть на отдельной странице” возвращалась корректно) */
    returnTo: string;
    onClose: () => void;
};

export default function FindingDetailsDrawer({ findingId, returnTo, onClose }: Props) {
    const open = Boolean(findingId);
    const [refreshKey, setRefreshKey] = useState(0);

    const drawerWidth = useMemo(
        () => ({
            xs: "100vw",
            sm: 560,
            md: 620,
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
                },
            }}
        >
            {/* Header (sticky) */}
            <Box
                sx={{
                    position: "sticky",
                    top: 0,
                    zIndex: 1,
                    bgcolor: "background.paper",
                    borderBottom: "1px solid",
                    borderColor: "divider",
                    px: 2,
                    py: 1.5,
                }}
            >
                <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
                    <Box sx={{ minWidth: 0 }}>
                        <Typography variant="subtitle2" color="text.secondary">
                            Детали находки
                        </Typography>
                        <Typography variant="caption" color="text.secondary" noWrap title={findingId ?? ""}>
                            {findingId ?? ""}
                        </Typography>
                    </Box>

                    <Stack direction="row" spacing={1} alignItems="center">
                        <Tooltip title="Открыть на отдельной странице">
                            <IconButton
                                component={RouterLink}
                                to={openInFullPageHref}
                                size="small"
                                aria-label="Открыть на отдельной странице"
                                disabled={!findingId}
                            >
                                <OpenInNewIcon fontSize="small" />
                            </IconButton>
                        </Tooltip>

                        <Tooltip title="Обновить">
                            <IconButton
                                size="small"
                                aria-label="Обновить"
                                onClick={() => setRefreshKey((k) => k + 1)}
                                disabled={!findingId}
                            >
                                <RefreshIcon fontSize="small" />
                            </IconButton>
                        </Tooltip>

                        <Tooltip title="Закрыть">
                            <IconButton onClick={onClose} size="small" aria-label="Закрыть">
                                <CloseIcon fontSize="small" />
                            </IconButton>
                        </Tooltip>
                    </Stack>
                </Stack>
            </Box>

            <Divider />

            {/* Body */}
            <Box sx={{ p: 2, overflow: "auto" }}>
                {findingId ? (
                    <FindingDetailErrorBoundary>
                        <FindingDetailContent
                            key={`${findingId}-${refreshKey}`}
                            id={findingId}
                            compact
                            returnTo={returnTo}
                        />
                    </FindingDetailErrorBoundary>
                ) : (
                    <Typography variant="body2" color="text.secondary">
                        Выберите находку, чтобы увидеть детали.
                    </Typography>
                )}
            </Box>
        </Drawer>
    );
}
