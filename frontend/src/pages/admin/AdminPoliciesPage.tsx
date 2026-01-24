import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import { useCallback, useEffect, useMemo, useState } from "react";
import AdminSectionLayout from "../../components/AdminSectionLayout";
import PaginationControl from "../../components/PaginationControl";
import { ProductAutocomplete } from "../../components/ProductAutocomplete";
import {
  addPolicyVersion,
  createPolicy,
  deletePolicy,
  fetchPolicies,
  fetchPolicyDetail,
  fetchPolicyResultDetail,
  fetchPolicyResults,
  updatePolicy,
  updatePolicyAssignments,
} from "../../api/policies";
import {
  PolicyAssignmentDTO,
  PolicyDetailDTO,
  PolicyKind,
  PolicyListItemDTO,
  PolicyResultDTO,
  PolicyResultDetailDTO,
  PolicyStatus,
} from "../../types/policies";

const DEFAULT_RULE_TEMPLATE = `package policy

# decision object
# {"outcome": "pass" | "warn" | "fail", "actions": [], "violations": []}
`;

const kindLabels: Record<PolicyKind, string> = {
  gate: "Gate",
  sla: "SLA",
  auto_triage: "Auto-triage",
};

const statusLabels: Record<PolicyStatus, string> = {
  enabled: "Enabled",
  disabled: "Disabled",
};

const policyDecisionStyles: Record<string, { label: string; color: string; border: string }> = {
  pass: { label: "PASS", color: "#81c784", border: "rgba(129, 199, 132, 0.45)" },
  warn: { label: "WARN", color: "#ffb74d", border: "rgba(255, 183, 77, 0.45)" },
  fail: { label: "FAIL", color: "#ef5350", border: "rgba(239, 83, 80, 0.5)" },
};

const buildEmptyAssignment = (): Omit<PolicyAssignmentDTO, "id" | "createdAt" | "policyId"> & {
  pinVersion?: string | null;
} => ({
  scope: "global",
  scopeId: "",
  priority: 0,
  policyRuleId: undefined,
  pinVersion: "",
});

const AdminPoliciesPage = () => {
  const [policies, setPolicies] = useState<PolicyListItemDTO[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<PolicyStatus | "">("");
  const [kindFilter, setKindFilter] = useState<PolicyKind | "">("");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogTab, setDialogTab] = useState(0);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [selectedPolicy, setSelectedPolicy] = useState<PolicyDetailDTO | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [formState, setFormState] = useState({
    name: "",
    description: "",
    kind: "gate" as PolicyKind,
    status: "disabled" as PolicyStatus,
  });

  const [initialRule, setInitialRule] = useState({
    version: "v1",
    format: "rego",
    entrypoint: "data.policy.decision",
    content: DEFAULT_RULE_TEMPLATE,
  });

  const [newVersion, setNewVersion] = useState({
    version: "",
    format: "rego",
    entrypoint: "data.policy.decision",
    content: DEFAULT_RULE_TEMPLATE,
  });

  const [assignmentsDraft, setAssignmentsDraft] = useState<
    Array<Omit<PolicyAssignmentDTO, "id" | "createdAt" | "policyId"> & { pinVersion?: string | null }>
  >([]);

  const [policyResults, setPolicyResults] = useState<PolicyResultDTO[]>([]);
  const [policyResultsTotal, setPolicyResultsTotal] = useState(0);
  const [policyResultsLoading, setPolicyResultsLoading] = useState(false);
  const [policyResultsFilters, setPolicyResultsFilters] = useState({
    productId: "",
    importJobId: "",
    decision: "",
    from: "",
    to: "",
  });
  const [resultDetail, setResultDetail] = useState<PolicyResultDetailDTO | null>(null);

  const fetchList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchPolicies({
        limit: pageSize,
        offset: page * pageSize,
        q: query || undefined,
        status: statusFilter || undefined,
        kind: kindFilter || undefined,
      });
      setPolicies(response.data);
      setTotal(response.total);
    } catch (err) {
      setError("Не удалось загрузить политики.");
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, query, statusFilter, kindFilter]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const handleOpenCreate = () => {
    setDialogMode("create");
    setDialogTab(0);
    setSelectedPolicy(null);
    setFormState({ name: "", description: "", kind: "gate", status: "disabled" });
    setInitialRule({
      version: "v1",
      format: "rego",
      entrypoint: "data.policy.decision",
      content: DEFAULT_RULE_TEMPLATE,
    });
    setAssignmentsDraft([buildEmptyAssignment()]);
    setDialogOpen(true);
  };

  const loadPolicyDetail = async (id: string) => {
    setDetailLoading(true);
    try {
      const detail = await fetchPolicyDetail(id);
      const versionMap = new Map(detail.versions.map((rule) => [rule.id, rule.version]));
      setSelectedPolicy(detail);
      setFormState({
        name: detail.name,
        description: detail.description ?? "",
        kind: detail.kind,
        status: detail.status,
      });
      setAssignmentsDraft(
        detail.assignments.length > 0
          ? detail.assignments.map((assignment) => ({
              scope: assignment.scope,
              scopeId: assignment.scopeId ?? "",
              priority: assignment.priority,
              policyRuleId: assignment.policyRuleId,
              pinVersion: assignment.policyRuleId ? versionMap.get(assignment.policyRuleId) ?? "" : "",
            }))
          : [buildEmptyAssignment()]
      );
      setNewVersion({
        version: "",
        format: "rego",
        entrypoint: detail.activeRule?.entrypoint ?? "data.policy.decision",
        content: DEFAULT_RULE_TEMPLATE,
      });
    } catch (err) {
      setError("Не удалось загрузить политику.");
    } finally {
      setDetailLoading(false);
    }
  };

  const handleOpenEdit = (policy: PolicyListItemDTO) => {
    setDialogMode("edit");
    setDialogTab(0);
    setDialogOpen(true);
    loadPolicyDetail(policy.id);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setSelectedPolicy(null);
    setResultDetail(null);
  };

  const handleSavePolicy = async () => {
    try {
      if (dialogMode === "create") {
        const created = await createPolicy({
          name: formState.name,
          kind: formState.kind,
          status: formState.status,
          description: formState.description || undefined,
          rule: {
            version: initialRule.version,
            format: initialRule.format,
            entrypoint: initialRule.entrypoint || undefined,
            content: initialRule.content,
          },
        });
        setSelectedPolicy(created);
        setDialogMode("edit");
        await fetchList();
      } else if (selectedPolicy) {
        const updated = await updatePolicy(selectedPolicy.id, {
          name: formState.name,
          status: formState.status,
          description: formState.description || undefined,
        });
        setSelectedPolicy(updated);
        await fetchList();
      }
    } catch (err) {
      setError("Не удалось сохранить политику.");
    }
  };

  const handleTogglePolicyStatus = async (policy: PolicyListItemDTO) => {
    try {
      const nextStatus: PolicyStatus = policy.status === "enabled" ? "disabled" : "enabled";
      await updatePolicy(policy.id, { status: nextStatus });
      await fetchList();
    } catch (err) {
      setError("Не удалось обновить статус.");
    }
  };

  const handleDeletePolicy = async (policy: PolicyListItemDTO) => {
    if (!window.confirm(`Удалить политику "${policy.name}"?`)) return;
    try {
      await deletePolicy(policy.id);
      await fetchList();
    } catch (err) {
      setError("Не удалось удалить политику.");
    }
  };

  const handleAddVersion = async () => {
    if (!selectedPolicy) return;
    try {
      await addPolicyVersion(selectedPolicy.id, {
        version: newVersion.version,
        format: newVersion.format,
        entrypoint: newVersion.entrypoint || undefined,
        content: newVersion.content,
      });
      await loadPolicyDetail(selectedPolicy.id);
      setNewVersion({
        version: "",
        format: "rego",
        entrypoint: selectedPolicy.activeRule?.entrypoint ?? "data.policy.decision",
        content: DEFAULT_RULE_TEMPLATE,
      });
    } catch (err) {
      setError("Не удалось добавить версию.");
    }
  };

  const handleSaveAssignments = async () => {
    if (!selectedPolicy) return;
    try {
      await updatePolicyAssignments(selectedPolicy.id, {
        assignments: assignmentsDraft.map((assignment) => ({
          scope: assignment.scope,
          scopeId: assignment.scopeId || undefined,
          priority: assignment.priority,
          pinVersion: assignment.pinVersion || undefined,
          policyRuleId: assignment.pinVersion ? undefined : assignment.policyRuleId || undefined,
        })),
      });
      await loadPolicyDetail(selectedPolicy.id);
    } catch (err) {
      setError("Не удалось обновить назначения.");
    }
  };

  const ruleValidation = useMemo(() => {
    const content = dialogMode === "create" ? initialRule.content : newVersion.content;
    if (!content.trim()) return "Контент правила обязателен.";
    if (!content.includes("package")) return "Rego должен содержать package.";
    return "";
  }, [dialogMode, initialRule.content, newVersion.content]);

  useEffect(() => {
    const loadResults = async () => {
      if (!selectedPolicy) return;
      setPolicyResultsLoading(true);
      try {
        const fromDate = policyResultsFilters.from
          ? new Date(policyResultsFilters.from)
          : null;
        const toDate = policyResultsFilters.to ? new Date(policyResultsFilters.to) : null;
        const response = await fetchPolicyResults({
          limit: 10,
          offset: 0,
          policyId: selectedPolicy.id,
          productId: policyResultsFilters.productId || undefined,
          importJobId: policyResultsFilters.importJobId || undefined,
          decision: policyResultsFilters.decision || undefined,
          from: fromDate && !Number.isNaN(fromDate.getTime()) ? fromDate.toISOString() : undefined,
          to: toDate && !Number.isNaN(toDate.getTime()) ? toDate.toISOString() : undefined,
        });
        setPolicyResults(response.data);
        setPolicyResultsTotal(response.total);
      } catch (err) {
        setPolicyResults([]);
        setPolicyResultsTotal(0);
      } finally {
        setPolicyResultsLoading(false);
      }
    };
    loadResults();
  }, [selectedPolicy, policyResultsFilters]);

  const handleOpenResultDetail = async (result: PolicyResultDTO) => {
    try {
      const detail = await fetchPolicyResultDetail(result.id);
      setResultDetail(detail);
    } catch (err) {
      setError("Не удалось загрузить детали решения.");
    }
  };

  const handleAssignmentChange = (index: number, key: string, value: string | number) => {
    setAssignmentsDraft((prev) =>
      prev.map((assignment, idx) =>
        idx === index ? { ...assignment, [key]: value } : assignment
      )
    );
  };

  const handleAddAssignmentRow = () => {
    setAssignmentsDraft((prev) => [...prev, buildEmptyAssignment()]);
  };

  const handleRemoveAssignmentRow = (index: number) => {
    setAssignmentsDraft((prev) => prev.filter((_, idx) => idx !== index));
  };

  const decisionChip = (decision: string) => {
    const meta = policyDecisionStyles[decision];
    if (!meta) return decision.toUpperCase();
    return (
      <Chip
        size="small"
        label={meta.label}
        variant="outlined"
        sx={{
          height: 24,
          fontSize: "0.7rem",
          fontWeight: 700,
          borderColor: meta.border,
          color: meta.color,
        }}
      />
    );
  };

  return (
    <AdminSectionLayout
      title="Policies"
      description="Управляйте политиками, версиями правил и назначениями."
    >
      <Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ mb: 3 }}>
        <Button variant="contained" onClick={handleOpenCreate}>
          Создать policy
        </Button>
        <TextField
          label="Поиск"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setPage(0);
          }}
          size="small"
          sx={{ minWidth: 220 }}
        />
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel id="policy-status-filter">Статус</InputLabel>
          <Select
            labelId="policy-status-filter"
            label="Статус"
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value as PolicyStatus | "");
              setPage(0);
            }}
          >
            <MenuItem value="">
              <em>Все</em>
            </MenuItem>
            <MenuItem value="enabled">Enabled</MenuItem>
            <MenuItem value="disabled">Disabled</MenuItem>
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel id="policy-kind-filter">Тип</InputLabel>
          <Select
            labelId="policy-kind-filter"
            label="Тип"
            value={kindFilter}
            onChange={(event) => {
              setKindFilter(event.target.value as PolicyKind | "");
              setPage(0);
            }}
          >
            <MenuItem value="">
              <em>Все</em>
            </MenuItem>
            <MenuItem value="gate">Gate</MenuItem>
            <MenuItem value="sla">SLA</MenuItem>
            <MenuItem value="auto_triage">Auto-triage</MenuItem>
          </Select>
        </FormControl>
      </Stack>

      {error && (
        <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
          <Typography color="error">{error}</Typography>
        </Paper>
      )}

      <TableContainer component={Paper} variant="outlined">
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Название</TableCell>
              <TableCell>Тип</TableCell>
              <TableCell>Статус</TableCell>
              <TableCell>Последняя версия</TableCell>
              <TableCell align="center">Назначений</TableCell>
              <TableCell>Обновлено</TableCell>
              <TableCell align="right">Действия</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                  <Typography color="text.secondary">Загрузка политик...</Typography>
                </TableCell>
              </TableRow>
            ) : policies.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                  <Typography color="text.secondary">Политик пока нет.</Typography>
                </TableCell>
              </TableRow>
            ) : (
              policies.map((policy) => (
                <TableRow key={policy.id} hover>
                  <TableCell>
                    <Stack spacing={0.5}>
                      <Typography fontWeight={600}>{policy.name}</Typography>
                      {policy.description ? (
                        <Typography variant="caption" color="text.secondary">
                          {policy.description}
                        </Typography>
                      ) : null}
                    </Stack>
                  </TableCell>
                  <TableCell>{kindLabels[policy.kind]}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={statusLabels[policy.status]}
                      color={policy.status === "enabled" ? "success" : "default"}
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell>{policy.latestVersion ?? "—"}</TableCell>
                  <TableCell align="center">{policy.assignmentsCount}</TableCell>
                  <TableCell>{new Date(policy.updatedAt).toLocaleString("ru-RU")}</TableCell>
                  <TableCell align="right">
                    <Stack direction="row" spacing={1} justifyContent="flex-end">
                      <Button size="small" variant="outlined" onClick={() => handleOpenEdit(policy)}>
                        Edit
                      </Button>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => handleTogglePolicyStatus(policy)}
                      >
                        {policy.status === "enabled" ? "Disable" : "Enable"}
                      </Button>
                      <Button
                        size="small"
                        color="error"
                        variant="outlined"
                        onClick={() => handleDeletePolicy(policy)}
                      >
                        Delete
                      </Button>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <PaginationControl
        page={page}
        pageSize={pageSize}
        total={total}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
      />

      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="lg" fullWidth>
        <DialogTitle>
          {dialogMode === "create" ? "Создать policy" : "Редактировать policy"}
        </DialogTitle>
        <DialogContent dividers>
          {detailLoading ? (
            <Typography color="text.secondary">Загрузка...</Typography>
          ) : (
            <Stack spacing={3}>
              <Tabs value={dialogTab} onChange={(_, value) => setDialogTab(value)}>
                <Tab label="Metadata" />
                <Tab label="Versions" />
                <Tab label="Assignments" />
              </Tabs>

              {dialogTab === 0 && (
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <TextField
                      label="Name"
                      value={formState.name}
                      onChange={(event) => setFormState((prev) => ({ ...prev, name: event.target.value }))}
                      fullWidth
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <FormControl fullWidth>
                      <InputLabel id="policy-kind">Kind</InputLabel>
                      <Select
                        labelId="policy-kind"
                        label="Kind"
                        value={formState.kind}
                        onChange={(event) =>
                          setFormState((prev) => ({ ...prev, kind: event.target.value as PolicyKind }))
                        }
                        disabled={dialogMode === "edit"}
                      >
                        <MenuItem value="gate">Gate</MenuItem>
                        <MenuItem value="sla">SLA</MenuItem>
                        <MenuItem value="auto_triage">Auto-triage</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <FormControl fullWidth>
                      <InputLabel id="policy-status">Status</InputLabel>
                      <Select
                        labelId="policy-status"
                        label="Status"
                        value={formState.status}
                        onChange={(event) =>
                          setFormState((prev) => ({ ...prev, status: event.target.value as PolicyStatus }))
                        }
                      >
                        <MenuItem value="enabled">Enabled</MenuItem>
                        <MenuItem value="disabled">Disabled</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      label="Description"
                      value={formState.description}
                      onChange={(event) =>
                        setFormState((prev) => ({ ...prev, description: event.target.value }))
                      }
                      fullWidth
                    />
                  </Grid>
                  {dialogMode === "create" && (
                    <Grid item xs={12}>
                      <Divider sx={{ my: 2 }} />
                      <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
                        Initial rule
                      </Typography>
                      <Grid container spacing={2}>
                        <Grid item xs={12} md={4}>
                          <TextField
                            label="Version"
                            value={initialRule.version}
                            onChange={(event) =>
                              setInitialRule((prev) => ({ ...prev, version: event.target.value }))
                            }
                            fullWidth
                          />
                        </Grid>
                        <Grid item xs={12} md={4}>
                          <TextField
                            label="Entrypoint"
                            value={initialRule.entrypoint}
                            onChange={(event) =>
                              setInitialRule((prev) => ({ ...prev, entrypoint: event.target.value }))
                            }
                            fullWidth
                          />
                        </Grid>
                        <Grid item xs={12} md={4}>
                          <TextField label="Format" value="rego" fullWidth disabled />
                        </Grid>
                        <Grid item xs={12}>
                          <TextField
                            label="Rego content"
                            value={initialRule.content}
                            onChange={(event) =>
                              setInitialRule((prev) => ({ ...prev, content: event.target.value }))
                            }
                            fullWidth
                            multiline
                            minRows={6}
                            helperText={ruleValidation || "Preview: минимум package + decision."}
                            error={Boolean(ruleValidation)}
                          />
                        </Grid>
                      </Grid>
                    </Grid>
                  )}
                </Grid>
              )}

              {dialogTab === 1 && (
                <Stack spacing={2}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                    Versions
                  </Typography>
                  {selectedPolicy?.versions.length ? (
                    <TableContainer component={Paper} variant="outlined">
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Version</TableCell>
                            <TableCell>Entrypoint</TableCell>
                            <TableCell>SHA</TableCell>
                            <TableCell>Created</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {selectedPolicy.versions.map((rule) => (
                            <TableRow key={rule.id}>
                              <TableCell>{rule.version}</TableCell>
                              <TableCell>{rule.entrypoint ?? "—"}</TableCell>
                              <TableCell>{rule.sha256.slice(0, 10)}...</TableCell>
                              <TableCell>
                                {new Date(rule.createdAt).toLocaleString("ru-RU")}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  ) : (
                    <Typography color="text.secondary">Версий пока нет.</Typography>
                  )}

                  {selectedPolicy && (
                    <Paper variant="outlined" sx={{ p: 2 }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                        Add version
                      </Typography>
                      <Grid container spacing={2}>
                        <Grid item xs={12} md={4}>
                          <TextField
                            label="Version"
                            value={newVersion.version}
                            onChange={(event) =>
                              setNewVersion((prev) => ({ ...prev, version: event.target.value }))
                            }
                            fullWidth
                          />
                        </Grid>
                        <Grid item xs={12} md={4}>
                          <TextField
                            label="Entrypoint"
                            value={newVersion.entrypoint}
                            onChange={(event) =>
                              setNewVersion((prev) => ({ ...prev, entrypoint: event.target.value }))
                            }
                            fullWidth
                          />
                        </Grid>
                        <Grid item xs={12} md={4}>
                          <TextField label="Format" value="rego" fullWidth disabled />
                        </Grid>
                        <Grid item xs={12}>
                          <TextField
                            label="Rego content"
                            value={newVersion.content}
                            onChange={(event) =>
                              setNewVersion((prev) => ({ ...prev, content: event.target.value }))
                            }
                            fullWidth
                            multiline
                            minRows={6}
                            helperText={ruleValidation || "Preview: минимум package + decision."}
                            error={Boolean(ruleValidation)}
                          />
                        </Grid>
                        <Grid item xs={12}>
                          <Button variant="contained" onClick={handleAddVersion}>
                            Добавить версию
                          </Button>
                        </Grid>
                      </Grid>
                    </Paper>
                  )}
                </Stack>
              )}

              {dialogTab === 2 && (
                <Stack spacing={2}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                    Assignments
                  </Typography>
                  <TableContainer component={Paper} variant="outlined">
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Scope</TableCell>
                          <TableCell>Scope ID</TableCell>
                          <TableCell>Priority</TableCell>
                          <TableCell>Pin version</TableCell>
                          <TableCell align="right">Actions</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {assignmentsDraft.map((assignment, index) => (
                          <TableRow key={`assignment-${index}`}>
                            <TableCell>
                              <FormControl size="small" fullWidth>
                                <Select
                                  value={assignment.scope}
                                  onChange={(event) =>
                                    handleAssignmentChange(index, "scope", event.target.value)
                                  }
                                >
                                  <MenuItem value="global">Global</MenuItem>
                                  <MenuItem value="product">Product</MenuItem>
                                  <MenuItem value="import_job">Import job</MenuItem>
                                  <MenuItem value="scan_result">Scan result</MenuItem>
                                </Select>
                              </FormControl>
                            </TableCell>
                            <TableCell>
                              <TextField
                                size="small"
                                value={assignment.scopeId ?? ""}
                                onChange={(event) =>
                                  handleAssignmentChange(index, "scopeId", event.target.value)
                                }
                                placeholder={assignment.scope === "global" ? "—" : "UUID"}
                                disabled={assignment.scope === "global"}
                                fullWidth
                              />
                            </TableCell>
                            <TableCell>
                              <TextField
                                size="small"
                                type="number"
                                value={assignment.priority}
                                onChange={(event) =>
                                  handleAssignmentChange(index, "priority", Number(event.target.value))
                                }
                                fullWidth
                              />
                            </TableCell>
                            <TableCell>
                              <TextField
                                size="small"
                                value={assignment.pinVersion ?? ""}
                                onChange={(event) =>
                                  handleAssignmentChange(index, "pinVersion", event.target.value)
                                }
                                placeholder="v1"
                                fullWidth
                              />
                            </TableCell>
                            <TableCell align="right">
                              <Button
                                size="small"
                                color="error"
                                onClick={() => handleRemoveAssignmentRow(index)}
                              >
                                Remove
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                  <Stack direction="row" spacing={2}>
                    <Button variant="outlined" onClick={handleAddAssignmentRow}>
                      Add assignment
                    </Button>
                    <Button variant="contained" onClick={handleSaveAssignments}>
                      Save assignments
                    </Button>
                  </Stack>
                </Stack>
              )}

              {selectedPolicy && (
                <Box>
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
                    Recent decisions
                  </Typography>
                  <Grid container spacing={2} sx={{ mb: 2 }}>
                    <Grid item xs={12} md={4}>
                      <ProductAutocomplete
                        value={policyResultsFilters.productId}
                        onChange={(value) =>
                          setPolicyResultsFilters((prev) => ({ ...prev, productId: value }))
                        }
                      />
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <TextField
                        label="Import job ID"
                        value={policyResultsFilters.importJobId}
                        onChange={(event) =>
                          setPolicyResultsFilters((prev) => ({ ...prev, importJobId: event.target.value }))
                        }
                        fullWidth
                      />
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <FormControl fullWidth>
                        <InputLabel id="policy-decision-filter">Decision</InputLabel>
                        <Select
                          labelId="policy-decision-filter"
                          label="Decision"
                          value={policyResultsFilters.decision}
                          onChange={(event) =>
                            setPolicyResultsFilters((prev) => ({ ...prev, decision: event.target.value }))
                          }
                        >
                          <MenuItem value="">
                            <em>Все</em>
                          </MenuItem>
                          <MenuItem value="pass">PASS</MenuItem>
                          <MenuItem value="warn">WARN</MenuItem>
                          <MenuItem value="fail">FAIL</MenuItem>
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid item xs={12} md={3}>
                      <TextField
                        label="From"
                        type="datetime-local"
                        InputLabelProps={{ shrink: true }}
                        value={policyResultsFilters.from}
                        onChange={(event) =>
                          setPolicyResultsFilters((prev) => ({ ...prev, from: event.target.value }))
                        }
                        fullWidth
                      />
                    </Grid>
                    <Grid item xs={12} md={3}>
                      <TextField
                        label="To"
                        type="datetime-local"
                        InputLabelProps={{ shrink: true }}
                        value={policyResultsFilters.to}
                        onChange={(event) =>
                          setPolicyResultsFilters((prev) => ({ ...prev, to: event.target.value }))
                        }
                        fullWidth
                      />
                    </Grid>
                  </Grid>

                  <TableContainer component={Paper} variant="outlined">
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Decision</TableCell>
                          <TableCell>Subject</TableCell>
                          <TableCell>Version</TableCell>
                          <TableCell>Evaluated</TableCell>
                          <TableCell align="right">Drilldown</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {policyResultsLoading ? (
                          <TableRow>
                            <TableCell colSpan={5} align="center" sx={{ py: 3 }}>
                              <Typography color="text.secondary">Загрузка...</Typography>
                            </TableCell>
                          </TableRow>
                        ) : policyResults.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} align="center" sx={{ py: 3 }}>
                              <Typography color="text.secondary">
                                Решений пока нет.
                              </Typography>
                            </TableCell>
                          </TableRow>
                        ) : (
                          policyResults.map((result) => (
                            <TableRow key={result.id} hover>
                              <TableCell>{decisionChip(result.decision)}</TableCell>
                              <TableCell>
                                <Stack spacing={0.5}>
                                  <Typography variant="body2" fontWeight={600}>
                                    {result.subjectType}
                                  </Typography>
                                  <Typography variant="caption" color="text.secondary">
                                    {result.subjectId}
                                  </Typography>
                                </Stack>
                              </TableCell>
                              <TableCell>{result.policyVersion ?? "—"}</TableCell>
                              <TableCell>
                                {new Date(result.evaluatedAt).toLocaleString("ru-RU")}
                              </TableCell>
                              <TableCell align="right">
                                <Button size="small" onClick={() => handleOpenResultDetail(result)}>
                                  View
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>
                  <Typography variant="caption" color="text.secondary">
                    Всего решений: {policyResultsTotal}
                  </Typography>
                </Box>
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Закрыть</Button>
          <Button variant="contained" onClick={handleSavePolicy}>
            Сохранить
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={Boolean(resultDetail)}
        onClose={() => setResultDetail(null)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Policy result detail</DialogTitle>
        <DialogContent dividers>
          {resultDetail && (
            <Stack spacing={2}>
              <Stack direction="row" spacing={2}>
                <Chip label={resultDetail.policyName ?? resultDetail.policyId} variant="outlined" />
                {resultDetail.policyVersion ? (
                  <Chip label={`v${resultDetail.policyVersion}`} variant="outlined" />
                ) : null}
                {decisionChip(resultDetail.decision)}
              </Stack>
              <Box>
                <Typography variant="subtitle2">Violations</Typography>
                <Paper variant="outlined" sx={{ p: 2, mt: 1 }}>
                  <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>
                    {JSON.stringify(resultDetail.violations ?? {}, null, 2)}
                  </pre>
                </Paper>
              </Box>
              <Box>
                <Typography variant="subtitle2">Actions</Typography>
                <Paper variant="outlined" sx={{ p: 2, mt: 1 }}>
                  <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>
                    {JSON.stringify(resultDetail.actions ?? [], null, 2)}
                  </pre>
                </Paper>
              </Box>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setResultDetail(null)}>Close</Button>
        </DialogActions>
      </Dialog>
    </AdminSectionLayout>
  );
};

export default AdminPoliciesPage;
