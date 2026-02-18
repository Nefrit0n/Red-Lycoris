import {
  Alert,
  Box,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Drawer,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Skeleton,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
  Checkbox,
  FormControlLabel,
} from "@mui/material";
import { DataGrid, type GridColDef, type GridPaginationModel, GridActionsCellItem } from "@mui/x-data-grid";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import AdminV2Shell from "../layout/AdminV2Shell";
import { Button } from "../../design-system/components/Button";
import {
  createIntegrationToken,
  getIntegrationTokenAudit,
  listIntegrationTokens,
  patchIntegrationToken,
  revokeIntegrationToken,
  rotateIntegrationToken,
} from "../../api/integrationTokens";
import type { IntegrationToken, IntegrationTokenAuditEvent, IntegrationTokenScope } from "../../types/integrationTokens";

const allScopes: IntegrationTokenScope[] = [
  "ingest:run:init",
  "ingest:artifact:write",
  "ingest:run:commit",
  "admin:tokens:read",
  "admin:tokens:write",
];

type StatusFilter = "ALL" | "ACTIVE" | "EXPIRING" | "REVOKED";

type RevokeTarget = { ids: string[]; label: string } | null;

const parseDate = (value?: string | null): Date | null => {
  if (!value) return null;
  const dt = new Date(value);
  return Number.isNaN(dt.getTime()) ? null : dt;
};

const formatDate = (value?: string | null, fallback = "—"): string => {
  const dt = parseDate(value);
  return dt ? dt.toLocaleString("ru-RU") : fallback;
};

const formatRelative = (value?: string | null, fallback = "—"): string => {
  const dt = parseDate(value);
  if (!dt) return fallback;
  const diffMs = Date.now() - dt.getTime();
  const absMs = Math.abs(diffMs);
  const minutes = Math.floor(absMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ${diffMs >= 0 ? "ago" : "from now"}`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${diffMs >= 0 ? "ago" : "from now"}`;
  const days = Math.floor(hours / 24);
  return `${days}d ${diffMs >= 0 ? "ago" : "from now"}`;
};

const formatCreatedBy = (createdBy: IntegrationToken["created_by"]): string => {
  if (!createdBy) return "System";
  if (typeof createdBy === "string") return createdBy || "System";
  if (typeof createdBy === "object") {
    const actor = createdBy as { name?: string; email?: string; id?: string };
    return actor.name || actor.email || actor.id || "System";
  }
  return "System";
};

const tokenStatus = (row: IntegrationToken): "Active" | "Revoked" | "Expired" => {
  if (row.state === "REVOKED") return "Revoked";
  if (row.state === "EXPIRED") return "Expired";
  const expiresAt = parseDate(row.expires_at);
  if (expiresAt && expiresAt.getTime() <= Date.now()) return "Expired";
  return "Active";
};

const isExpiringInDays = (row: IntegrationToken, days: number) => {
  const expiresAt = parseDate(row.expires_at);
  if (!expiresAt || tokenStatus(row) !== "Active") return false;
  return expiresAt <= new Date(Date.now() + days * 24 * 60 * 60 * 1000);
};

const IntegrationTokensPage = () => {
  const navigate = useNavigate();
  const { id: tokenIdFromRoute } = useParams<{ id?: string }>();
  const [items, setItems] = useState<IntegrationToken[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [pagination, setPagination] = useState<GridPaginationModel>({ page: 0, pageSize: 25 });
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [projectFilter, setProjectFilter] = useState("ALL");
  const [expiringIn, setExpiringIn] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [detailsToken, setDetailsToken] = useState<IntegrationToken | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<RevokeTarget>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [createError, setCreateError] = useState("");
  const [createdToken, setCreatedToken] = useState<{ secret?: string; name: string } | null>(null);
  const [savedTokenAck, setSavedTokenAck] = useState(false);
  const [auditOpen, setAuditOpen] = useState(false);
  const [auditTokenId, setAuditTokenId] = useState<string>("");
  const [auditItems, setAuditItems] = useState<IntegrationTokenAuditEvent[]>([]);
  const [auditEventType, setAuditEventType] = useState("");
  const [auditFrom, setAuditFrom] = useState("");
  const [auditTo, setAuditTo] = useState("");

  const [form, setForm] = useState({
    name: "",
    org_id: "",
    project_id: "",
    scopeType: "org" as "org" | "project",
    expiresDays: "30",
    scopes: ["ingest:run:init", "ingest:artifact:write", "ingest:run:commit"] as IntegrationTokenScope[],
  });

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await listIntegrationTokens({
        org_id: form.org_id || "00000000-0000-0000-0000-000000000000",
        project_id: projectFilter !== "ALL" ? projectFilter : undefined,
        page: pagination.page + 1,
        page_size: pagination.pageSize,
        status: statusFilter === "ACTIVE" ? "ACTIVE" : statusFilter === "REVOKED" ? "REVOKED" : undefined,
        search: search || undefined,
      });
      let rows = response.items ?? [];
      if (statusFilter === "EXPIRING") {
        rows = rows.filter((it) => isExpiringInDays(it, 7));
      }
      if (expiringIn) {
        rows = rows.filter((it) => isExpiringInDays(it, Number(expiringIn)));
      }
      setItems(rows);
      setTotal(response.total ?? rows.length);
    } catch (e: any) {
      const status = e?.status;
      if ([401, 403, 422, 429].includes(status)) {
        setError(`Ошибка API (${status}). Проверьте права/лимиты и параметры.`);
      } else {
        setError("Не удалось загрузить токены интеграций.");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [pagination.page, pagination.pageSize, statusFilter, projectFilter, expiringIn, search]);

  useEffect(() => {
    if (!tokenIdFromRoute) return;
    const token = items.find((item) => item.id === tokenIdFromRoute);
    if (token) {
      setDetailsToken(token);
    }
  }, [tokenIdFromRoute, items]);

  const activeCount = useMemo(() => items.filter((it) => tokenStatus(it) === "Active").length, [items]);
  const expiringSoonCount = useMemo(() => items.filter((it) => isExpiringInDays(it, 7)).length, [items]);
  const revokedCount = useMemo(() => items.filter((it) => tokenStatus(it) === "Revoked").length, [items]);
  const neverUsedCount = useMemo(() => items.filter((it) => !parseDate(it.last_used_at)).length, [items]);
  const hasActiveFilters = useMemo(
    () => Boolean(search || expiringIn || projectFilter !== "ALL" || statusFilter !== "ALL"),
    [search, expiringIn, projectFilter, statusFilter]
  );
  const projectOptions = useMemo(() => Array.from(new Set(items.map((it) => it.tenant.project_id).filter(Boolean))) as string[], [items]);

  const columns: GridColDef<IntegrationToken>[] = [
    { field: "name", headerName: "Name", flex: 1.2 },
    { field: "scope", headerName: "Scope", flex: 0.8, valueGetter: (_, row) => (row.tenant.project_id ? "Project" : "Org") },
    {
      field: "permissions",
      headerName: "Permissions",
      flex: 1.2,
      sortable: false,
      renderCell: (params) => {
        if ((params.row as any).__skeleton) return <Skeleton variant="text" width="70%" />;
        const scopeList = params.row.scopes || [];
        return (
          <Tooltip title={scopeList.length ? <Box>{scopeList.map((s) => <Typography key={s} variant="caption" display="block">{s}</Typography>)}</Box> : "No permissions"}>
            <Chip size="small" label={`${scopeList.length} scopes`} />
          </Tooltip>
        );
      },
    },
    {
      field: "status",
      headerName: "Status",
      flex: 0.8,
      valueGetter: (_, row) => tokenStatus(row),
      renderCell: (params) => {
        if ((params.row as any).__skeleton) return <Skeleton variant="text" width="60%" />;
        return <Chip size="small" color={params.value === "Active" ? "success" : params.value === "Expired" ? "warning" : "default"} label={String(params.value)} />;
      },
    },
    {
      field: "last_used_at",
      headerName: "Last used",
      flex: 1.1,
      valueGetter: (_, row) => (parseDate(row.last_used_at) ? `${formatDate(row.last_used_at)} (${formatRelative(row.last_used_at)})` : "Never"),
    },
    { field: "expires_at", headerName: "Expires", flex: 1, valueGetter: (_, row) => formatDate(row.expires_at) },
    { field: "created_at", headerName: "Created", flex: 1, valueGetter: (_, row) => formatDate(row.created_at) },
    { field: "created_by", headerName: "Created by", flex: 1, valueGetter: (_, row) => formatCreatedBy(row.created_by) },
    {
      field: "actions",
      type: "actions",
      headerName: "Actions",
      getActions: (params) => {
        if ((params.row as any).__skeleton) return [];
        return [
          <GridActionsCellItem icon={<span />} label="View details" showInMenu onClick={() => {
            setDetailsToken(params.row);
            navigate(`/admin/integrations/tokens/${params.row.id}`);
          }} />,
          <GridActionsCellItem icon={<span />} label="View audit" showInMenu onClick={() => openAudit(params.row.id)} />,
          <GridActionsCellItem icon={<span />} label="Revoke" showInMenu onClick={() => setRevokeTarget({ ids: [params.row.id], label: `Revoke token “${params.row.name}”?` })} />,
          <GridActionsCellItem icon={<span />} label="Rotate" showInMenu onClick={() => handleRotate(params.row.id)} />,
          <GridActionsCellItem icon={<ContentCopyIcon fontSize="small" />} label="Copy id" showInMenu onClick={() => navigator.clipboard.writeText(params.row.id)} />,
        ];
      },
    },
  ];

  const handleCreate = async () => {
    setCreateError("");
    if (!form.name.trim()) {
      setCreateError("Укажите имя токена.");
      return;
    }
    if (!form.scopes.length) {
      setCreateError("Выберите минимум один scope.");
      return;
    }

    try {
      const expiresAt = new Date(Date.now() + Number(form.expiresDays) * 86400000).toISOString();
      const response = await createIntegrationToken({
        name: form.name.trim(),
        tenant: {
          org_id: form.org_id || "00000000-0000-0000-0000-000000000000",
          project_id: form.scopeType === "project" ? form.project_id || undefined : undefined,
        },
        scopes: form.scopes,
        expires_at: expiresAt,
      });
      setCreateOpen(false);
      setSavedTokenAck(false);
      setCreatedToken({ secret: response.token_secret, name: response.token.name });
      await load();
    } catch (e: any) {
      const status = e?.status;
      if (status === 400) setCreateError("Некорректные поля формы. Проверьте дату/ID и попробуйте снова.");
      else if (status === 409) setCreateError("Токен с таким именем уже существует в выбранном контуре.");
      else if (status === 422) setCreateError("Запрос отклонён политикой токенов (scope/TTL).");
      else if ([401, 403].includes(status)) setCreateError("Недостаточно прав для создания токена.");
      else setCreateError("Не удалось создать токен. Попробуйте ещё раз.");
    }
  };

  const confirmRevoke = async () => {
    if (!revokeTarget?.ids.length) return;
    await Promise.all(revokeTarget.ids.map((id) => revokeIntegrationToken(id)));
    setSelected([]);
    setRevokeTarget(null);
    await load();
  };

  const handleRotate = async (id: string) => {
    const response = await rotateIntegrationToken(id);
    setSavedTokenAck(false);
    setCreatedToken({ secret: response.token_secret, name: response.token.name });
    await load();
  };

  const handleExtend = async (id: string) => {
    const value = window.prompt("New expiry ISO datetime", new Date(Date.now() + 30 * 86400000).toISOString());
    if (!value) return;
    await patchIntegrationToken(id, { expires_at: value });
    await load();
  };

  const openAudit = async (id: string) => {
    setAuditTokenId(id);
    setAuditOpen(true);
    const data = await getIntegrationTokenAudit(id, { limit: 200 });
    setAuditItems(data.items || []);
  };

  const filteredAudit = useMemo(() => {
    return auditItems.filter((e) => {
      if (auditEventType && e.action !== auditEventType) return false;
      const occurredAt = parseDate(e.occurred_at);
      if (!occurredAt) return false;
      if (auditFrom) {
        const fromDate = parseDate(auditFrom);
        if (fromDate && occurredAt < fromDate) return false;
      }
      if (auditTo) {
        const toDate = parseDate(auditTo);
        if (toDate && occurredAt > toDate) return false;
      }
      return true;
    });
  }, [auditItems, auditEventType, auditFrom, auditTo]);

  const clearFilters = () => {
    setSearch("");
    setProjectFilter("ALL");
    setStatusFilter("ALL");
    setExpiringIn("");
  };

  const skeletonRows = useMemo(
    () => Array.from({ length: 5 }, (_, index) => ({ id: `skeleton-${index}`, name: "", revision: 0, tenant: { org_id: "" }, scopes: [], state: "ACTIVE", created_at: "", __skeleton: true })) as IntegrationToken[],
    []
  );

  return (
    <AdminV2Shell title="Integration Tokens" primaryAction={{ label: "Create Token", onClick: () => setCreateOpen(true) }}>
      <Stack spacing={2}>
        <Typography variant="body2" color="text.secondary">Токен показывается полностью только при создании.</Typography>

        {error && <Alert severity="error">{error}</Alert>}

        <Stack direction="row" spacing={1} flexWrap="wrap">
          <Chip label={`Active: ${activeCount}`} color={statusFilter === "ACTIVE" ? "primary" : "default"} onClick={() => setStatusFilter("ACTIVE")} />
          <Chip label={`Expiring soon (7d): ${expiringSoonCount}`} color={statusFilter === "EXPIRING" ? "primary" : "default"} onClick={() => setStatusFilter("EXPIRING")} />
          <Chip label={`Revoked: ${revokedCount}`} color={statusFilter === "REVOKED" ? "primary" : "default"} onClick={() => setStatusFilter("REVOKED")} />
          <Chip label={`Never used: ${neverUsedCount}`} onClick={() => setExpiringIn("")} />
        </Stack>

        <Stack direction={{ xs: "column", lg: "row" }} spacing={1}>
          <TextField label="Search (name/id)" value={search} onChange={(e) => setSearch(e.target.value)} sx={{ minWidth: 220 }} />
          <FormControl sx={{ minWidth: 170 }}>
            <InputLabel>Project</InputLabel>
            <Select label="Project" value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)}>
              <MenuItem value="ALL">All</MenuItem>
              {projectOptions.map((project) => <MenuItem key={project} value={project}>{project}</MenuItem>)}
            </Select>
          </FormControl>
          <Box>
            <Tabs value={statusFilter} onChange={(_, value) => setStatusFilter(value)}>
              <Tab label="Active" value="ACTIVE" />
              <Tab label="Expiring soon" value="EXPIRING" />
              <Tab label="Revoked" value="REVOKED" />
              <Tab label="All" value="ALL" />
            </Tabs>
          </Box>
          <FormControl sx={{ minWidth: 170 }}>
            <InputLabel>Expiring in</InputLabel>
            <Select label="Expiring in" value={expiringIn} onChange={(e) => setExpiringIn(e.target.value)}>
              <MenuItem value="">Any</MenuItem>
              <MenuItem value="7">7 days</MenuItem>
              <MenuItem value="30">30 days</MenuItem>
              <MenuItem value="90">90 days</MenuItem>
            </Select>
          </FormControl>
          {hasActiveFilters && <Button variant="outlined" onClick={clearFilters}>Clear filters</Button>}
        </Stack>

        <Stack direction={{ xs: "column", md: "row" }} spacing={1} alignItems={{ md: "center" }} justifyContent="space-between" sx={{ py: 1, px: 1.5, border: "1px solid", borderColor: "divider", borderRadius: 1 }}>
          <Typography variant="body2">{selected.length} selected</Typography>
          <Stack direction="row" spacing={1}>
            <Button variant="outlined" onClick={() => setSelected([])} disabled={!selected.length}>Clear selection</Button>
            <Button color="error" onClick={() => setRevokeTarget({ ids: selected, label: `Revoke ${selected.length} selected token(s)?` })} disabled={!selected.length}>Revoke selected</Button>
          </Stack>
        </Stack>

        <Box sx={{ height: 640, minHeight: 640 }}>
          <DataGrid
            rows={loading ? skeletonRows : items}
            columns={columns}
            paginationMode="server"
            rowCount={total}
            paginationModel={pagination}
            onPaginationModelChange={setPagination}
            checkboxSelection
            disableRowSelectionOnClick
            isRowSelectable={(params) => !(params.row as any).__skeleton}
            onRowSelectionModelChange={(model) => setSelected(model.filter((id) => String(id).startsWith("skeleton-") === false) as string[])}
            onRowClick={(params) => {
              if ((params.row as any).__skeleton) return;
              setDetailsToken(params.row);
              navigate(`/admin/integrations/tokens/${params.row.id}`);
            }}
          />
        </Box>

        {!loading && items.length === 0 && !hasActiveFilters && (
          <Alert severity="info" action={<Button onClick={() => setCreateOpen(true)}>Create token</Button>}>
            No integration tokens yet.
          </Alert>
        )}
        {!loading && items.length === 0 && hasActiveFilters && (
          <Alert severity="info" action={<Button onClick={clearFilters}>Clear filters</Button>}>
            Nothing matches current filters.
          </Alert>
        )}
      </Stack>

      <Drawer anchor="right" open={createOpen} onClose={() => setCreateOpen(false)}>
        <Box sx={{ width: 420, p: 2 }}>
          <Typography variant="h6">Create Token</Typography>
          {createError && <Alert severity="error" sx={{ mt: 2 }}>{createError}</Alert>}
          <Stack spacing={2} sx={{ mt: 2 }}>
            <TextField required label="Name" value={form.name} onChange={(e) => setForm((v) => ({ ...v, name: e.target.value }))} />
            <TextField label="Org ID" value={form.org_id} onChange={(e) => setForm((v) => ({ ...v, org_id: e.target.value }))} />
            <FormControl>
              <InputLabel>Scope</InputLabel>
              <Select label="Scope" value={form.scopeType} onChange={(e) => setForm((v) => ({ ...v, scopeType: e.target.value as "org" | "project" }))}>
                <MenuItem value="org">Org</MenuItem>
                <MenuItem value="project">Project</MenuItem>
              </Select>
            </FormControl>
            {form.scopeType === "project" && <TextField label="Project ID" value={form.project_id} onChange={(e) => setForm((v) => ({ ...v, project_id: e.target.value }))} />}
            <FormControl>
              <InputLabel>Expiration</InputLabel>
              <Select label="Expiration" value={form.expiresDays} onChange={(e) => setForm((v) => ({ ...v, expiresDays: e.target.value }))}>
                <MenuItem value="7">7 days</MenuItem>
                <MenuItem value="30">30 days</MenuItem>
                <MenuItem value="90">90 days</MenuItem>
              </Select>
            </FormControl>
            <FormControl>
              <InputLabel>Permissions</InputLabel>
              <Select
                multiple
                label="Permissions"
                value={form.scopes}
                onChange={(e) => setForm((v) => ({ ...v, scopes: e.target.value as IntegrationTokenScope[] }))}
              >
                {allScopes.map((scope) => <MenuItem key={scope} value={scope}>{scope}</MenuItem>)}
              </Select>
            </FormControl>
            <Button onClick={handleCreate}>Create</Button>
          </Stack>
        </Box>
      </Drawer>

      <Dialog open={Boolean(createdToken)} onClose={() => setCreatedToken(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Token created</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">Token for {createdToken?.name}. It is shown once only.</Typography>
          {createdToken?.secret ? (
            <TextField fullWidth sx={{ mt: 2 }} value={createdToken.secret} InputProps={{ readOnly: true }} />
          ) : (
            <Alert severity="info" sx={{ mt: 2 }}>API did not return a secret. Please use your secure vault flow.</Alert>
          )}
          <FormControlLabel sx={{ mt: 2 }} control={<Checkbox checked={savedTokenAck} onChange={(e) => setSavedTokenAck(e.target.checked)} />} label="I saved it" />
        </DialogContent>
        <DialogActions>
          <Button
            variant="outlined"
            onClick={async () => {
              if (!createdToken?.secret) return;
              await navigator.clipboard.writeText(createdToken.secret);
            }}
            disabled={!createdToken?.secret}
          >
            Copy
          </Button>
          <Button onClick={() => setCreatedToken(null)} disabled={!savedTokenAck}>Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(revokeTarget)} onClose={() => setRevokeTarget(null)}>
        <DialogTitle>Confirm revoke</DialogTitle>
        <DialogContent>
          <Typography>{revokeTarget?.label}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>This action is destructive and cannot be undone.</Typography>
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={() => setRevokeTarget(null)}>Cancel</Button>
          <Button color="error" onClick={confirmRevoke}>Revoke</Button>
        </DialogActions>
      </Dialog>

      <Drawer anchor="right" open={Boolean(detailsToken)} onClose={() => {
        setDetailsToken(null);
        navigate("/admin/integrations/tokens");
      }}>
        <Box sx={{ width: 480, p: 2 }}>
          <Typography variant="h6">Token details</Typography>
          {detailsToken && (
            <Stack spacing={1.2} sx={{ mt: 2 }}>
              <Typography><strong>Name:</strong> {detailsToken.name}</Typography>
              <Typography><strong>Scope:</strong> {detailsToken.tenant.project_id ? `Project (${detailsToken.tenant.project_id})` : "Org"}</Typography>
              <Typography><strong>Created by:</strong> {formatCreatedBy(detailsToken.created_by)}</Typography>
              <Typography><strong>Created:</strong> {formatDate(detailsToken.created_at)}</Typography>
              <Typography><strong>Last used:</strong> {formatDate(detailsToken.last_used_at, "Never")}</Typography>
              <Typography><strong>Expires:</strong> {formatDate(detailsToken.expires_at)}</Typography>
              <Typography><strong>Status:</strong> {tokenStatus(detailsToken)}</Typography>
              <Typography><strong>Permissions:</strong></Typography>
              <Box component="ul" sx={{ my: 0, pl: 2 }}>
                {detailsToken.scopes.map((scope) => <li key={scope}><Typography variant="body2">{scope}</Typography></li>)}
              </Box>
              <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                <Button color="error" onClick={() => setRevokeTarget({ ids: [detailsToken.id], label: `Revoke token “${detailsToken.name}”?` })}>Revoke</Button>
                <Button variant="outlined" onClick={() => handleRotate(detailsToken.id)}>Rotate</Button>
                <Button variant="outlined" onClick={() => openAudit(detailsToken.id)}>Audit log</Button>
                <Button variant="outlined" onClick={() => handleExtend(detailsToken.id)}>Extend expiry</Button>
              </Stack>
            </Stack>
          )}
        </Box>
      </Drawer>

      <Drawer anchor="right" open={auditOpen} onClose={() => setAuditOpen(false)}>
        <Box sx={{ width: 560, p: 2 }}>
          <Typography variant="h6">Token audit</Typography>
          <Typography variant="body2" color="text.secondary">Token ID: {auditTokenId}</Typography>
          <Stack direction="row" spacing={1} sx={{ my: 2 }}>
            <FormControl sx={{ minWidth: 160 }}>
              <InputLabel>Event type</InputLabel>
              <Select label="Event type" value={auditEventType} onChange={(e) => setAuditEventType(e.target.value)}>
                <MenuItem value="">All</MenuItem>
                <MenuItem value="ISSUED">created</MenuItem>
                <MenuItem value="REVOKED">revoked</MenuItem>
                <MenuItem value="ROTATED">rotated</MenuItem>
                <MenuItem value="USED">used</MenuItem>
              </Select>
            </FormControl>
            <TextField type="date" label="From" InputLabelProps={{ shrink: true }} value={auditFrom} onChange={(e) => setAuditFrom(e.target.value)} />
            <TextField type="date" label="To" InputLabelProps={{ shrink: true }} value={auditTo} onChange={(e) => setAuditTo(e.target.value)} />
          </Stack>
          <Box sx={{ height: 520 }}>
            <DataGrid
              rows={filteredAudit.map((e) => ({ ...e, id: e.id }))}
              columns={[
                { field: "action", headerName: "Event", flex: 1 },
                { field: "actor_type", headerName: "Actor", flex: 1 },
                { field: "occurred_at", headerName: "At", flex: 1.2, valueGetter: (_, row) => formatDate(row.occurred_at) },
                { field: "ip", headerName: "IP", flex: 1 },
              ]}
              disableRowSelectionOnClick
            />
          </Box>
        </Box>
      </Drawer>
    </AdminV2Shell>
  );
};

export default IntegrationTokensPage;
