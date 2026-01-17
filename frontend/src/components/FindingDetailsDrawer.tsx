import {
    Alert,
    Box,
    Button,
    Chip,
    CircularProgress,
    Divider,
    Drawer,
    IconButton,
    Stack,
    Tooltip,
    Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import { fetchFindingDetail } from "../api/findings";
import { FindingDetail, FindingSeverity, FindingStatus } from "../types/findings";

type Props = {
    /** id выбранной находки. null/"" => панель закрыта */
    findingId: string | null;
    /** путь списка (чтобы кнопка “открыть на отдельной странице” возвращалась корректно) */
    returnTo: string;
    onClose: () => void;
};

const severityLabel: Record<FindingSeverity, string> = {
    low: "Low",
    medium: "Medium",
    high: "High",
    critical: "Critical",
};

const statusLabel: Record<FindingStatus, string> = {
    new: "New",
    under_review: "Under review",
    confirmed: "Confirmed",
    false_positive: "False positive",
    out_of_scope: "Out of scope",
    risk_accepted: "Risk accepted",
    mitigated: "Mitigated",
    duplicate: "Duplicate",
};

// чуть спокойнее, чем “кислотные” дефолты
const statusColor: Record<FindingStatus, "default" | "info" | "success" | "warning"> = {
    new: "info",
    under_review: "warning",
    confirmed: "success",
    false_positive: "default",
    out_of_scope: "default",
    risk_accepted: "warning",
    mitigated: "success",
    duplicate: "default",
};

const safeDateRu = (value?: string | null) => {
    if (!value) return "—";
    const dt = new Date(value);
    if (Number.isNaN(dt.getTime())) return "—";
    try {
        return new Intl.DateTimeFormat("ru-RU", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
        }).format(dt);
    } catch {
        return dt.toLocaleString("ru-RU");
    }
};

const clip = async (text: string) => {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch {
        return false;
    }
};

export default function FindingDetailsDrawer({ findingId, returnTo, onClose }: Props) {
    const open = Boolean(findingId);

    const cacheRef = useRef<Map<string, FindingDetail>>(new Map());
    const [data, setData] = useState<FindingDetail | null>(null);
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState<string | null>(null);
    const [copied, setCopied] = useState<string | null>(null);

    const drawerWidth = useMemo(
        () => ({
            xs: "100vw",
            sm: 520,
            md: 560,
        }),
        []
    );

    useEffect(() => {
        if (!findingId) {
            setData(null);
            setErr(null);
            setLoading(false);
            return;
        }

        const cached = cacheRef.current.get(findingId);
        if (cached) setData(cached);

        const ctrl = new AbortController();
        setLoading(true);
        setErr(null);

        fetchFindingDetail(findingId, ctrl.signal)
            .then((res) => {
                cacheRef.current.set(findingId, res);
                setData(res);
            })
            .catch((e) => {
                // Abort — не ошибка для UI
                if (e instanceof DOMException && e.name === "AbortError") return;
                setErr(e instanceof Error ? e.message : "Не удалось загрузить детали");
            })
            .finally(() => setLoading(false));

        return () => ctrl.abort();
    }, [findingId]);

    const title = data?.title ?? "Детали находки";

    const openInFullPageHref = findingId
        ? `/findings/${findingId}${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ""}`
        : "#";

    const handleCopy = async (label: string, value?: string | null) => {
        if (!value) return;
        const ok = await clip(value);
        setCopied(ok ? label : "Не удалось скопировать");
        window.setTimeout(() => setCopied(null), 1200);
    };

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
                <Stack direction="row" alignItems="center" spacing={1} justifyContent="space-between">
                    <Box sx={{ minWidth: 0 }}>
                        <Typography variant="subtitle2" color="text.secondary">
                            Детали находки
                        </Typography>
                        <Typography variant="h6" sx={{ lineHeight: 1.2 }} noWrap title={title}>
                            {title}
                        </Typography>
                    </Box>

                    <Stack direction="row" spacing={1} alignItems="center">
                        <Tooltip title="Открыть на отдельной странице">
                            <IconButton
                                component={RouterLink}
                                to={openInFullPageHref}
                                size="small"
                                aria-label="Открыть на отдельной странице"
                            >
                                <OpenInNewIcon fontSize="small" />
                            </IconButton>
                        </Tooltip>
                        <Tooltip title="Закрыть">
                            <IconButton onClick={onClose} size="small" aria-label="Закрыть">
                                <CloseIcon fontSize="small" />
                            </IconButton>
                        </Tooltip>
                    </Stack>
                </Stack>

                {/* Quick chips */}
                <Stack direction="row" spacing={1} mt={1} flexWrap="wrap" useFlexGap>
                    {data?.severity && (
                        <Chip size="small" variant="outlined" label={severityLabel[data.severity] ?? data.severity} />
                    )}
                    {data?.status && (
                        <Chip
                            size="small"
                            color={statusColor[data.status]}
                            label={statusLabel[data.status] ?? data.status}
                            sx={{ textTransform: "none" }}
                        />
                    )}
                    {typeof (data as any)?.repeatCount === "number" && (
                        <Chip size="small" variant="outlined" label={`Repeats: ${(data as any).repeatCount}`} />
                    )}
                    {copied && <Chip size="small" color="success" label={copied} />}
                </Stack>
            </Box>

            {/* Body */}
            <Box sx={{ p: 2, overflow: "auto" }}>
                {loading && !data && (
                    <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
                        <CircularProgress />
                    </Box>
                )}

                {err && (
                    <Alert
                        severity="error"
                        action={
                            <Button
                                color="inherit"
                                size="small"
                                onClick={() => {
                                    // просто “дернуть” заново через смену findingId не можем, поэтому имитируем:
                                    if (findingId) {
                                        cacheRef.current.delete(findingId);
                                        setData(null);
                                        setErr(null);
                                        setLoading(false);
                                        // useEffect перезапустится, т.к. findingId тот же — вручную триггернем:
                                        // простое решение: вызвать onClose/open снова уже из FindingsList. Пока оставим кнопку без авто-retry.
                                    }
                                }}
                            >
                                Ок
                            </Button>
                        }
                    >
                        {err}
                    </Alert>
                )}

                {!data && !loading && !err && (
                    <Typography variant="body2" color="text.secondary">
                        Выберите находку, чтобы увидеть детали.
                    </Typography>
                )}

                {data && (
                    <Stack spacing={2}>
                        <Box>
                            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                                Описание
                            </Typography>
                            <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
                                {(data as any).description || "—"}
                            </Typography>
                        </Box>

                        <Divider />

                        <Box>
                            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                                Метаданные
                            </Typography>

                            <Stack spacing={1}>
                                <MetaRow
                                    label="Finding ID"
                                    value={data.id}
                                    onCopy={() => handleCopy("ID скопирован", data.id)}
                                />
                                <MetaRow
                                    label="Product"
                                    value={(data as any).productName || (data as any).productId || "—"}
                                />
                                <MetaRow
                                    label="Scanner"
                                    value={(data as any).scannerType || "—"}
                                />
                                <MetaRow
                                    label="Fingerprint"
                                    value={(data as any).fingerprint}
                                    mono
                                    onCopy={() => handleCopy("Fingerprint скопирован", (data as any).fingerprint)}
                                />
                                <MetaRow label="First seen" value={safeDateRu((data as any).firstSeenAt)} />
                                <MetaRow label="Last seen" value={safeDateRu((data as any).lastSeenAt)} />
                                <MetaRow label="Created" value={safeDateRu((data as any).createdAt)} />
                                <MetaRow label="Updated" value={safeDateRu((data as any).updatedAt)} />
                            </Stack>
                        </Box>

                        <Divider />

                        <Alert severity="info">
                            Следующий шаг: подключим эту панель к списку находок (клик по строке → открытие Drawer),
                            и сделаем компактный список “в две строки” вместо таблицы на 10 колонок.
                        </Alert>
                    </Stack>
                )}
            </Box>
        </Drawer>
    );
}

function MetaRow({
    label,
    value,
    mono,
    onCopy,
}: {
    label: string;
    value: string;
    mono?: boolean;
    onCopy?: () => void;
}) {
    return (
        <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
            <Typography variant="body2" color="text.secondary" sx={{ minWidth: 120 }}>
                {label}
            </Typography>

            <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
                <Typography
                    variant="body2"
                    sx={{
                        fontFamily: mono ? "monospace" : "inherit",
                        maxWidth: 320,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                    }}
                    title={value}
                >
                    {value || "—"}
                </Typography>

                {onCopy && value && value !== "—" && (
                    <Tooltip title="Скопировать">
                        <IconButton size="small" onClick={onCopy} aria-label={`Скопировать ${label}`}>
                            <ContentCopyIcon fontSize="inherit" />
                        </IconButton>
                    </Tooltip>
                )}
            </Stack>
        </Stack>
    );
}
