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
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { DataGrid, type GridColDef, type GridPaginationModel, GridActionsCellItem } from "@mui/x-data-grid";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
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

const fmt = (v?: string) => (v ? new Date(v).toLocaleString("ru-RU") : "—");

const tokenStatus = (row: IntegrationToken) => row.state === "REVOKED" ? "Revoked" : row.state === "EXPIRED" ? "Expired" : "Active";

const IntegrationTokensPage = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState<IntegrationToken[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [pagination, setPagination] = useState<GridPaginationModel>({ page: 0, pageSize: 25 });
  const [statusFilter, setStatusFilter] = useState("");
  const [projectFilter, setProjectFilter] = useState("");
  const [expiringIn, setExpiringIn] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string[]>([]);

  const [createOpen, setCreateOpen] = useState(false);
  const [createError, setCreateError] = useState("");
  const [createdToken, setCreatedToken] = useState<{ secret: string; name: string } | null>(null);
  const [auditOpen, setAuditOpen] = useState(false);
  const [auditTokenId, setAuditTokenId] = useState<string>("");
  const [auditItems, setAuditItems] = useState<IntegrationTokenAuditEvent[]>([]);
  const [auditEventType, setAuditEventType] = useState("");
  const [auditFrom, setAuditFrom] = useState("");
  const [auditTo, setAuditTo] = useState("");

  const [form, setForm] = useState({ name: "", org_id: "", project_id: "", expires_at: "", scopes: ["ingest:run:init", "ingest:artifact:write", "ingest:run:commit"] as IntegrationTokenScope[] });

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await listIntegrationTokens({
        org_id: form.org_id || "00000000-0000-0000-0000-000000000000",
        project_id: projectFilter || undefined,
        page: pagination.page + 1,
        page_size: pagination.pageSize,
        status: statusFilter || undefined,
        search: search || undefined,
      });
      let rows = response.items ?? [];
      if (expiringIn) {
        const days = Number(expiringIn);
        const until = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
        rows = rows.filter((it) => it.expires_at && new Date(it.expires_at) <= until && tokenStatus(it) === "Active");
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

  const expiringSoon = useMemo(
    () => items.filter((it) => it.expires_at && tokenStatus(it) === "Active" && new Date(it.expires_at) <= new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)),
    [items]
  );

  const columns: GridColDef<IntegrationToken>[] = [
    { field: "name", headerName: "Name", flex: 1.2 },
    { field: "scope", headerName: "Scope(org/project)", flex: 1, valueGetter: (_, row) => (row.tenant.project_id ? "project" : "org") },
    { field: "project", headerName: "Project", flex: 1, valueGetter: (_, row) => row.tenant.project_id || "—" },
    {
      field: "scopes",
      headerName: "Scopes",
      flex: 1.5,
      renderCell: (params) => (
        <Stack direction="row" gap={0.5} sx={{ overflow: "hidden" }}>
          {(params.row.scopes || []).slice(0, 2).map((s) => <Chip key={s} label={s} size="small" />)}
          {(params.row.scopes || []).length > 2 && <Chip size="small" label={`+${(params.row.scopes || []).length - 2}`} />}
        </Stack>
      ),
    },
    { field: "created_at", headerName: "Created", flex: 1, valueGetter: (_, row) => fmt(row.created_at) },
    { field: "expires_at", headerName: "Expires", flex: 1, valueGetter: (_, row) => fmt(row.expires_at) },
    {
      field: "status",
      headerName: "Status",
      flex: 0.8,
      valueGetter: (_, row) => tokenStatus(row),
      renderCell: (params) => <Chip size="small" color={params.value === "Active" ? "success" : params.value === "Expired" ? "warning" : "default"} label={String(params.value)} />,
    },
    { field: "last_used_at", headerName: "Last used", flex: 1, valueGetter: (_, row) => fmt(row.last_used_at) },
    { field: "created_by", headerName: "Created by", flex: 1, valueGetter: (_, row) => row.created_by || "—" },
    {
      field: "actions",
      type: "actions",
      headerName: "Actions",
      getActions: (params) => [
        <GridActionsCellItem icon={<span />} label="View audit" showInMenu onClick={() => openAudit(params.row.id)} />,
        <GridActionsCellItem icon={<span />} label="Revoke" showInMenu onClick={() => handleRevoke(params.row.id)} />,
        <GridActionsCellItem icon={<span />} label="Rotate" showInMenu onClick={() => handleRotate(params.row.id)} />,
        <GridActionsCellItem icon={<span />} label="Extend expiry" showInMenu onClick={() => handleExtend(params.row.id)} />,
        <GridActionsCellItem icon={<span />} label="Rename" showInMenu onClick={() => handleRename(params.row.id)} />,
      ],
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
      const expiresAt = form.expires_at ? new Date(form.expires_at).toISOString() : undefined;
      const response = await createIntegrationToken({
        name: form.name.trim(),
        tenant: { org_id: form.org_id || "00000000-0000-0000-0000-000000000000", project_id: form.project_id || undefined },
        scopes: form.scopes,
        expires_at: expiresAt,
      });
      setCreateOpen(false);
      setCreatedToken({ secret: response.token_secret, name: response.token.name });
      await load();
    } catch (e: any) {
      const status = e?.status;
      if (status === 400) {
        setCreateError("Некорректные поля формы. Проверьте дату/ID и попробуйте снова.");
      } else if (status === 409) {
        setCreateError("Токен с таким именем уже существует в выбранном контуре.");
      } else if (status === 422) {
        setCreateError("Запрос отклонён политикой токенов (scope/TTL).");
      } else if ([401, 403].includes(status)) {
        setCreateError("Недостаточно прав для создания токена.");
      } else {
        setCreateError("Не удалось создать токен. Попробуйте ещё раз.");
      }
    }
  };

  const handleRevoke = async (id: string) => {
    if (!window.confirm("Revoke token?")) return;
    await revokeIntegrationToken(id);
    await load();
  };

  const handleRotate = async (id: string) => {
    const response = await rotateIntegrationToken(id);
    setCreatedToken({ secret: response.token_secret, name: response.token.name });
    await load();
  };

  const handleRename = async (id: string) => {
    const value = window.prompt("New name");
    if (!value) return;
    await patchIntegrationToken(id, { name: value });
    await load();
  };

  const handleExtend = async (id: string) => {
    const value = window.prompt("New expiry ISO datetime", new Date(Date.now() + 30 * 86400000).toISOString());
    if (!value) return;
    await patchIntegrationToken(id, { expires_at: value });
    await load();
  };

  const handleBulkRevoke = async () => {
    if (!selected.length) return;
    if (!window.confirm(`Revoke ${selected.length} selected tokens?`)) return;
    await Promise.all(selected.map((id) => revokeIntegrationToken(id)));
    setSelected([]);
    await load();
  };

  const openAudit = async (id: string) => {
    setAuditTokenId(id);
    setAuditOpen(true);
    navigate(`/admin/integrations/tokens/${id}`);
    const data = await getIntegrationTokenAudit(id, { limit: 200 });
    setAuditItems(data.items || []);
  };

  const filteredAudit = useMemo(() => {
    return auditItems.filter((e) => {
      if (auditEventType && e.action !== auditEventType) return false;
      if (auditFrom && new Date(e.occurred_at) < new Date(auditFrom)) return false;
      if (auditTo && new Date(e.occurred_at) > new Date(auditTo)) return false;
      return true;
    });
  }, [auditItems, auditEventType, auditFrom, auditTo]);

  return (
    <AdminV2Shell
      title="Integration Tokens"
      primaryAction={{ label: "Create Token", onClick: () => setCreateOpen(true) }}
    >
      <Stack spacing={2}>
        <Typography variant="body2" color="text.secondary">Admin → Integrations → Tokens</Typography>

        {expiringSoon.length > 0 && <Alert severity="warning">{expiringSoon.length} token(s) expire in 7 days.</Alert>}
        {error && <Alert severity="error">{error}</Alert>}

        <Stack direction={{ xs: "column", md: "row" }} spacing={1}>
          <TextField label="Search by name" value={search} onChange={(e) => setSearch(e.target.value)} />
          <TextField label="Project" value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)} />
          <FormControl sx={{ minWidth: 140 }}>
            <InputLabel>Status</InputLabel>
            <Select label="Status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <MenuItem value="">All</MenuItem>
              <MenuItem value="ACTIVE">Active</MenuItem>
              <MenuItem value="EXPIRED">Expired</MenuItem>
              <MenuItem value="REVOKED">Revoked</MenuItem>
            </Select>
          </FormControl>
          <FormControl sx={{ minWidth: 140 }}>
            <InputLabel>Expiring in</InputLabel>
            <Select label="Expiring in" value={expiringIn} onChange={(e) => setExpiringIn(e.target.value)}>
              <MenuItem value="">Any</MenuItem>
              <MenuItem value="7">7 days</MenuItem>
              <MenuItem value="30">30 days</MenuItem>
              <MenuItem value="60">60 days</MenuItem>
            </Select>
          </FormControl>
          <Button variant="outlined" onClick={handleBulkRevoke} disabled={!selected.length}>Revoke selected</Button>
        </Stack>

        <Box sx={{ height: 640 }}>
          <DataGrid
            rows={items}
            columns={columns}
            loading={loading}
            paginationMode="server"
            rowCount={total}
            paginationModel={pagination}
            onPaginationModelChange={setPagination}
            checkboxSelection
            disableRowSelectionOnClick
            onRowSelectionModelChange={(model) => setSelected(model as string[])}
          />
        </Box>

        {!loading && items.length === 0 && <Alert severity="info">No integration tokens yet. Create your first token.</Alert>}
      </Stack>

      <Drawer anchor="right" open={createOpen} onClose={() => setCreateOpen(false)}>
        <Box sx={{ width: 420, p: 2 }}>
          <Typography variant="h6">Create Token</Typography>
          <Typography variant="body2" color="text.secondary">Policy: default ttl 90 days / max ttl 365 days</Typography>
          {createError && <Alert severity="error" sx={{ mt: 2 }}>{createError}</Alert>}
          <Stack spacing={2} sx={{ mt: 2 }}>
            <TextField label="Name" value={form.name} onChange={(e) => setForm((v) => ({ ...v, name: e.target.value }))} />
            <TextField label="Org ID" value={form.org_id} onChange={(e) => setForm((v) => ({ ...v, org_id: e.target.value }))} />
            <TextField label="Project ID (optional)" value={form.project_id} onChange={(e) => setForm((v) => ({ ...v, project_id: e.target.value }))} />
            <TextField label="Expires at" type="datetime-local" InputLabelProps={{ shrink: true }} value={form.expires_at} onChange={(e) => setForm((v) => ({ ...v, expires_at: e.target.value }))} />
            <FormControl>
              <InputLabel>Scopes</InputLabel>
              <Select
                multiple
                label="Scopes"
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
          <Typography variant="body2" color="text.secondary">Token is shown only once. Copy it now.</Typography>
          <TextField fullWidth sx={{ mt: 2 }} value={createdToken?.secret || ""} InputProps={{ readOnly: true }} />
        </DialogContent>
        <DialogActions>
          <Button
            variant="outlined"
            onClick={async () => {
              if (!createdToken?.secret) return;
              await navigator.clipboard.writeText(createdToken.secret);
            }}
          >
            Copy
          </Button>
          <Button
            variant="outlined"
            onClick={() => {
              if (!createdToken?.secret) return;
              const blob = new Blob([`LW_TOKEN=${createdToken.secret}\n`], { type: "text/plain" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = "lw-token.env";
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            Download .env snippet
          </Button>
          <Button onClick={() => setCreatedToken(null)}>Close</Button>
        </DialogActions>
      </Dialog>

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
                { field: "occurred_at", headerName: "At", flex: 1.2, valueGetter: (_, row) => fmt(row.occurred_at) },
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
