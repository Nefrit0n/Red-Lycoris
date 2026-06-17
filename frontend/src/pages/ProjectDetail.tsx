import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiClientError, apiDelete, apiGet, apiPost, apiPut } from "@/api/client";
import { useCurrentUser } from "@/api/auth";
import { useUpdateProject } from "@/api/projects";
import type { Project } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import ProjectSettingsTokens from "@/pages/ProjectSettingsTokens";
import ProjectScans from "@/pages/ProjectScans";

interface Member {
  user_id: string;
  email: string;
  full_name: string;
  role: number;
}

interface WorkspaceMember {
  id: string;
  email: string;
  display_name?: string;
}

interface WorkspaceTeam {
  id: string;
  name: string;
}

interface ProjectSettingsForm {
  name: string;
  slug: string;
  description: string;
  icon_color: string;
  tags: string;
  status: Project["status"];
  source_kind: Project["source_kind"];
  repo_provider: NonNullable<Project["repo_provider"]>;
  repo_url: string;
  default_branch: string;
  autoscan_on_push: boolean;
  owner_id: string;
  team_id: string;
  visibility: Project["visibility"];
  sla_critical_days: string;
  sla_high_days: string;
  sla_medium_days: string;
  sla_low_days: string;
  sla_notify_before_days: string;
}

const NO_TEAM_VALUE = "__no_team__";

function formFromProject(project: Project): ProjectSettingsForm {
  return {
    name: project.name ?? "",
    slug: project.slug ?? "",
    description: project.description ?? "",
    icon_color: project.icon_color || "#64748b",
    tags: (project.tags ?? []).join(", "),
    status: project.status,
    source_kind: project.source_kind ?? (project.repo_url ? "git" : "manual"),
    repo_provider: project.repo_provider ?? "other",
    repo_url: project.repo_url ?? "",
    default_branch: project.default_branch ?? "main",
    autoscan_on_push: Boolean(project.autoscan_on_push),
    owner_id: project.owner?.id ?? "",
    team_id: project.team?.id ?? "",
    visibility: project.visibility ?? "workspace",
    sla_critical_days: project.sla_critical_days?.toString() ?? "",
    sla_high_days: project.sla_high_days?.toString() ?? "",
    sla_medium_days: project.sla_medium_days?.toString() ?? "",
    sla_low_days: project.sla_low_days?.toString() ?? "",
    sla_notify_before_days: String(project.sla_notify_before_days ?? 3),
  };
}

function splitTags(value: string): string[] {
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean)
    .filter((tag, index, tags) => tags.findIndex((item) => item.toLowerCase() === tag.toLowerCase()) === index);
}

function parseOptionalDays(value: string, label: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${label}: укажите положительное число дней`);
  }
  return parsed;
}

function parseNotifyDays(value: string): number {
  const trimmed = value.trim();
  if (!trimmed) return 0;
  const parsed = Number(trimmed);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error("Уведомление SLA: укажите 0 или положительное число дней");
  }
  return parsed;
}

function buildProjectSettingsPayload(form: ProjectSettingsForm): Record<string, unknown> {
  if (!form.name.trim()) {
    throw new Error("Название проекта обязательно");
  }

  const source =
    form.source_kind === "git"
      ? {
          kind: "git",
          provider: form.repo_provider,
          repo_url: form.repo_url.trim(),
          default_branch: form.default_branch.trim() || "main",
          autoscan_on_push: form.autoscan_on_push,
        }
      : {
          kind: form.source_kind,
        };

  if (form.source_kind === "git" && !form.repo_url.trim()) {
    throw new Error("Для Git-источника укажите URL репозитория");
  }

  return {
    name: form.name.trim(),
    slug: form.slug.trim(),
    description: form.description.trim(),
    icon_color: form.icon_color.trim() || "#64748b",
    tags: splitTags(form.tags),
    status: form.status,
    owner_id: form.owner_id,
    team_id: form.team_id,
    visibility: form.visibility,
    source,
    sla: {
      critical_days: parseOptionalDays(form.sla_critical_days, "Критичный SLA"),
      high_days: parseOptionalDays(form.sla_high_days, "Высокий SLA"),
      medium_days: parseOptionalDays(form.sla_medium_days, "Средний SLA"),
      low_days: parseOptionalDays(form.sla_low_days, "Низкий SLA"),
      notify_before_breach_days: parseNotifyDays(form.sla_notify_before_days),
    },
  };
}

function roleLabel(role: number): string {
  if (role === 2) return "Администратор проекта";
  if (role === 1) return "Триаж";
  return "Просмотр";
}

function statusLabel(status: Project["status"]): string {
  if (status === "paused") return "Пауза";
  if (status === "archived") return "Архивный";
  return "Активный";
}

function sourceKindLabel(sourceKind: Project["source_kind"]): string {
  if (sourceKind === "git") return "Git";
  if (sourceKind === "sarif") return "SARIF / JSON";
  if (sourceKind === "webhook") return "Webhook";
  return "Ручной";
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiClientError ? error.message : fallback;
}

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: user } = useCurrentUser();
  const updateProject = useUpdateProject();
  const [addOpen, setAddOpen] = useState(false);
  const [q, setQ] = useState("");
  const [selectedUser, setSelectedUser] = useState<string>("");
  const [settingsForm, setSettingsForm] = useState<ProjectSettingsForm | null>(null);
  const [settingsError, setSettingsError] = useState("");
  const [settingsSuccess, setSettingsSuccess] = useState("");

  const projectQuery = useQuery({
    queryKey: ["project", id],
    queryFn: async () => {
      const res = await apiGet<{ data: Project }>(`/api/v1/projects/${id}`);
      return res.data;
    },
    enabled: Boolean(id),
  });

  useEffect(() => {
    if (!projectQuery.data) return;
    setSettingsForm(formFromProject(projectQuery.data));
  }, [projectQuery.data]);

  const membersQuery = useQuery({
    queryKey: ["project-members", id],
    queryFn: async () => {
      const res = await apiGet<{ data: Member[] }>(`/api/v1/projects/${id}/members`);
      return res.data;
    },
    enabled: Boolean(id),
  });

  const workspaceMembersQuery = useQuery({
    queryKey: ["workspace-members"],
    queryFn: async () => {
      const res = await apiGet<{ data: WorkspaceMember[] }>("/api/v1/workspace/members", { q: "" });
      return res.data;
    },
    staleTime: 60_000,
  });

  const workspaceTeamsQuery = useQuery({
    queryKey: ["workspace-teams"],
    queryFn: async () => {
      const res = await apiGet<{ data: WorkspaceTeam[] }>("/api/v1/workspace/teams");
      return res.data;
    },
    staleTime: 60_000,
  });

  const myRole = useMemo(() => {
    const me = (membersQuery.data ?? []).find((m) => m.email === user?.email);
    return me?.role ?? -1;
  }, [membersQuery.data, user?.email]);

  const canManageSettings = myRole >= 2 || user?.global_role === 1;
  const canChangeOwner = Boolean(user && projectQuery.data && (user.global_role === 1 || projectQuery.data.owner.id === user.id));

  const ownerOptions = useMemo(() => {
    const options = new Map<string, WorkspaceMember>();
    const project = projectQuery.data;
    if (project?.owner?.id) {
      options.set(project.owner.id, {
        id: project.owner.id,
        email: project.owner.email,
        display_name: project.owner.display_name,
      });
    }
    (workspaceMembersQuery.data ?? []).forEach((member) => {
      options.set(member.id, member);
    });
    return Array.from(options.values()).sort((a, b) => (a.display_name || a.email).localeCompare(b.display_name || b.email));
  }, [projectQuery.data, workspaceMembersQuery.data]);

  const searchUsers = useQuery({
    queryKey: ["users-search", q],
    queryFn: async () => {
      const res = await apiGet<{ data: Array<{ id: string; email: string; full_name: string }> }>(
        "/api/v1/users/search",
        { q },
      );
      return res.data;
    },
    enabled: q.length > 1,
  });

  const addMember = useMutation({
    mutationFn: () => apiPost(`/api/v1/projects/${id}/members`, { user_id: selectedUser, role: 1 }),
    onSuccess: async () => {
      setAddOpen(false);
      setSelectedUser("");
      await queryClient.invalidateQueries({ queryKey: ["project-members", id] });
    },
  });

  const updateMemberRole = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: number }) =>
      apiPut(`/api/v1/projects/${id}/members/${userId}`, { role }),
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ["project-members", id] }),
  });

  const removeMember = useMutation({
    mutationFn: (userId: string) => apiDelete(`/api/v1/projects/${id}/members/${userId}`),
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ["project-members", id] }),
  });

  if (!id) return <Navigate to="/projects" replace />;

  const tabFromQuery = searchParams.get("tab");
  const activeTab =
    tabFromQuery === "overview" ||
    tabFromQuery === "findings" ||
    tabFromQuery === "members" ||
    tabFromQuery === "settings" ||
    tabFromQuery === "tokens" ||
    tabFromQuery === "scans"
      ? tabFromQuery
      : "overview";

  const patchSettings = (patch: Partial<ProjectSettingsForm>) => {
    setSettingsError("");
    setSettingsSuccess("");
    setSettingsForm((prev) => (prev ? { ...prev, ...patch } : prev));
  };

  const handleSaveSettings = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!settingsForm || !id || !canManageSettings) return;

    let payload: Record<string, unknown>;
    try {
      payload = buildProjectSettingsPayload(settingsForm);
    } catch (err) {
      setSettingsError(err instanceof Error ? err.message : "Проверьте настройки проекта");
      return;
    }

    updateProject.mutate(
      { id, body: payload },
      {
        onSuccess: (res) => {
          setSettingsError("");
          setSettingsSuccess("Настройки проекта сохранены");
          setSettingsForm(formFromProject(res.data));
        },
        onError: (error) => {
          setSettingsSuccess("");
          setSettingsError(errorMessage(error, "Не удалось сохранить настройки проекта"));
        },
      },
    );
  };

  return (
    <Tabs
      value={activeTab}
      onValueChange={(value) => {
        const next = new URLSearchParams(searchParams);
        next.set("tab", value);
        setSearchParams(next, { replace: true });
      }}
      className="space-y-4"
    >
      <TabsList>
        <TabsTrigger value="overview">Обзор</TabsTrigger>
        <TabsTrigger value="findings">Находки</TabsTrigger>
        <TabsTrigger value="members">Участники</TabsTrigger>
        <TabsTrigger value="settings">Настройки</TabsTrigger>
        <TabsTrigger value="tokens">Токены</TabsTrigger>
        <TabsTrigger value="scans">Сканы</TabsTrigger>
      </TabsList>

      <TabsContent value="overview">
        <Card className="border-zinc-800 bg-zinc-900">
          <CardHeader><CardTitle>{projectQuery.data?.name ?? "Проект"}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-zinc-300">{projectQuery.data?.description || "Описание отсутствует"}</p>
            {projectQuery.data && (
              <div className="flex flex-wrap gap-2 text-xs text-zinc-400">
                <Badge variant="secondary">{statusLabel(projectQuery.data.status)}</Badge>
                <Badge variant="secondary">{sourceKindLabel(projectQuery.data.source_kind)}</Badge>
                <span className="font-mono text-zinc-500">{projectQuery.data.id}</span>
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="findings">
        <Card className="border-zinc-800 bg-zinc-900">
          <CardHeader><CardTitle>Находки проекта</CardTitle></CardHeader>
          <CardContent>
            <Button onClick={() => navigate(`/findings?project_id=${id}`)}>Перейти к находкам</Button>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="members">
        {!canManageSettings ? (
          <Card className="border-zinc-800 bg-zinc-900"><CardContent className="pt-6">Недостаточно прав для управления участниками.</CardContent></Card>
        ) : (
          <Card className="border-zinc-800 bg-zinc-900">
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Участники</CardTitle>
              <Button onClick={() => setAddOpen(true)}>Добавить участника</Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {(membersQuery.data ?? []).map((m) => (
                <div key={m.user_id} className="flex items-center justify-between rounded border border-zinc-800 p-2">
                  <div>
                    <div>{m.full_name || m.email}</div>
                    <div className="text-xs text-zinc-400">{m.email}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge>{roleLabel(m.role)}</Badge>
                    <Button size="sm" variant="outline" onClick={() => updateMemberRole.mutate({ userId: m.user_id, role: m.role === 2 ? 1 : 2 })}>Изменить роль</Button>
                    <Button size="sm" variant="outline" onClick={() => removeMember.mutate(m.user_id)}>Удалить</Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </TabsContent>

      <TabsContent value="settings">
        <Card className="border-zinc-800 bg-zinc-900">
          <CardHeader>
            <CardTitle>Настройки проекта</CardTitle>
          </CardHeader>
          <CardContent>
            {!canManageSettings ? (
              <p className="text-sm text-zinc-400">Недостаточно прав для изменения настроек проекта.</p>
            ) : !settingsForm ? (
              <p className="text-sm text-zinc-400">Загрузка настроек...</p>
            ) : (
              <form onSubmit={handleSaveSettings} className="space-y-6">
                <section className="space-y-3">
                  <div>
                    <h3 className="text-sm font-medium text-zinc-100">Основные параметры</h3>
                    <p className="text-xs text-zinc-500">ID проекта не меняется при сохранении этих полей.</p>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="space-y-1 text-sm">
                      <span className="text-xs text-zinc-400">Название</span>
                      <Input value={settingsForm.name} onChange={(e) => patchSettings({ name: e.target.value })} />
                    </label>
                    <label className="space-y-1 text-sm">
                      <span className="text-xs text-zinc-400">Slug</span>
                      <Input value={settingsForm.slug} onChange={(e) => patchSettings({ slug: e.target.value })} />
                    </label>
                    <label className="space-y-1 text-sm md:col-span-2">
                      <span className="text-xs text-zinc-400">Описание</span>
                      <textarea
                        className="min-h-24 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-red-700/70"
                        value={settingsForm.description}
                        onChange={(e) => patchSettings({ description: e.target.value })}
                      />
                    </label>
                    <label className="space-y-1 text-sm">
                      <span className="text-xs text-zinc-400">Теги через запятую</span>
                      <Input value={settingsForm.tags} onChange={(e) => patchSettings({ tags: e.target.value })} />
                    </label>
                    <label className="space-y-1 text-sm">
                      <span className="text-xs text-zinc-400">Цвет проекта</span>
                      <div className="flex gap-2">
                        <Input value={settingsForm.icon_color} onChange={(e) => patchSettings({ icon_color: e.target.value })} />
                        <input
                          type="color"
                          value={settingsForm.icon_color}
                          onChange={(e) => patchSettings({ icon_color: e.target.value })}
                          className="h-9 w-12 rounded border border-zinc-700 bg-zinc-950"
                          aria-label="Цвет проекта"
                        />
                      </div>
                    </label>
                    <label className="space-y-1 text-sm">
                      <span className="text-xs text-zinc-400">Статус</span>
                      <Select value={settingsForm.status} onValueChange={(value) => patchSettings({ status: (value ?? "active") as Project["status"] })}>
                        <SelectTrigger className="w-full border-zinc-700 bg-zinc-950 text-zinc-100">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="border-zinc-700 bg-zinc-900">
                          <SelectItem value="active">Активный</SelectItem>
                          <SelectItem value="paused">Пауза</SelectItem>
                          <SelectItem value="archived">Архивный</SelectItem>
                        </SelectContent>
                      </Select>
                    </label>
                  </div>
                </section>

                <section className="space-y-3 border-t border-zinc-800 pt-5">
                  <div>
                    <h3 className="text-sm font-medium text-zinc-100">Источник</h3>
                    <p className="text-xs text-zinc-500">Изменение источника не отзывает и не перевыпускает API токены.</p>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="space-y-1 text-sm">
                      <span className="text-xs text-zinc-400">Тип источника</span>
                      <Select value={settingsForm.source_kind} onValueChange={(value) => patchSettings({ source_kind: (value ?? "manual") as Project["source_kind"] })}>
                        <SelectTrigger className="w-full border-zinc-700 bg-zinc-950 text-zinc-100">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="border-zinc-700 bg-zinc-900">
                          <SelectItem value="manual">Ручной</SelectItem>
                          <SelectItem value="git">Git</SelectItem>
                          <SelectItem value="sarif">SARIF / JSON</SelectItem>
                          <SelectItem value="webhook">Webhook</SelectItem>
                        </SelectContent>
                      </Select>
                    </label>
                    {settingsForm.source_kind === "webhook" && (
                      <div className="flex items-end">
                        <Button type="button" variant="outline" onClick={() => navigate(`/projects/${id}?tab=tokens`)}>
                          Перейти к токенам
                        </Button>
                      </div>
                    )}
                    {settingsForm.source_kind === "git" && (
                      <>
                        <label className="space-y-1 text-sm">
                          <span className="text-xs text-zinc-400">Провайдер</span>
                          <Select value={settingsForm.repo_provider} onValueChange={(value) => patchSettings({ repo_provider: (value ?? "other") as NonNullable<Project["repo_provider"]> })}>
                            <SelectTrigger className="w-full border-zinc-700 bg-zinc-950 text-zinc-100">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="border-zinc-700 bg-zinc-900">
                              <SelectItem value="github">GitHub</SelectItem>
                              <SelectItem value="gitlab">GitLab</SelectItem>
                              <SelectItem value="bitbucket">Bitbucket</SelectItem>
                              <SelectItem value="other">Другой</SelectItem>
                            </SelectContent>
                          </Select>
                        </label>
                        <label className="space-y-1 text-sm">
                          <span className="text-xs text-zinc-400">URL репозитория</span>
                          <Input value={settingsForm.repo_url} onChange={(e) => patchSettings({ repo_url: e.target.value })} />
                        </label>
                        <label className="space-y-1 text-sm">
                          <span className="text-xs text-zinc-400">Основная ветка</span>
                          <Input value={settingsForm.default_branch} onChange={(e) => patchSettings({ default_branch: e.target.value })} />
                        </label>
                        <label className="flex items-center gap-3 pt-6 text-sm text-zinc-300">
                          <Switch
                            checked={settingsForm.autoscan_on_push}
                            onCheckedChange={(checked) => patchSettings({ autoscan_on_push: Boolean(checked) })}
                          />
                          Автосканирование при push
                        </label>
                      </>
                    )}
                  </div>
                </section>

                <section className="space-y-3 border-t border-zinc-800 pt-5">
                  <div>
                    <h3 className="text-sm font-medium text-zinc-100">Доступ и SLA</h3>
                    <p className="text-xs text-zinc-500">Смена owner не удаляет старого owner из участников проекта.</p>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="space-y-1 text-sm">
                      <span className="text-xs text-zinc-400">Owner</span>
                      <Select
                        value={settingsForm.owner_id}
                        onValueChange={(value) => patchSettings({ owner_id: value ?? settingsForm.owner_id })}
                        disabled={!canChangeOwner}
                      >
                        <SelectTrigger className="w-full border-zinc-700 bg-zinc-950 text-zinc-100">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="border-zinc-700 bg-zinc-900">
                          {ownerOptions.map((member) => (
                            <SelectItem key={member.id} value={member.id}>
                              {member.display_name || member.email}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </label>
                    <label className="space-y-1 text-sm">
                      <span className="text-xs text-zinc-400">Команда</span>
                      <Select
                        value={settingsForm.team_id || NO_TEAM_VALUE}
                        onValueChange={(value) => patchSettings({ team_id: value === NO_TEAM_VALUE ? "" : value ?? "" })}
                      >
                        <SelectTrigger className="w-full border-zinc-700 bg-zinc-950 text-zinc-100">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="border-zinc-700 bg-zinc-900">
                          <SelectItem value={NO_TEAM_VALUE}>Без команды</SelectItem>
                          {(workspaceTeamsQuery.data ?? []).map((team) => (
                            <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </label>
                    <div className="space-y-1 text-sm md:col-span-2">
                      <span className="text-xs text-zinc-400">Видимость</span>
                      <div className="flex flex-wrap gap-2">
                        {([
                          ["private", "Приватный"],
                          ["team", "Команда"],
                          ["workspace", "Workspace"],
                        ] as Array<[Project["visibility"], string]>).map(([value, label]) => (
                          <Button
                            key={value}
                            type="button"
                            variant={settingsForm.visibility === value ? "default" : "outline"}
                            onClick={() => patchSettings({ visibility: value })}
                          >
                            {label}
                          </Button>
                        ))}
                      </div>
                    </div>
                    {[
                      ["sla_critical_days", "Критичный SLA"],
                      ["sla_high_days", "Высокий SLA"],
                      ["sla_medium_days", "Средний SLA"],
                      ["sla_low_days", "Низкий SLA"],
                    ].map(([key, label]) => (
                      <label key={key} className="space-y-1 text-sm">
                        <span className="text-xs text-zinc-400">{label}, дней</span>
                        <Input
                          type="number"
                          min={1}
                          value={settingsForm[key as keyof ProjectSettingsForm] as string}
                          onChange={(e) => patchSettings({ [key]: e.target.value } as Partial<ProjectSettingsForm>)}
                        />
                      </label>
                    ))}
                    <label className="space-y-1 text-sm">
                      <span className="text-xs text-zinc-400">Уведомлять до нарушения SLA, дней</span>
                      <Input
                        type="number"
                        min={0}
                        value={settingsForm.sla_notify_before_days}
                        onChange={(e) => patchSettings({ sla_notify_before_days: e.target.value })}
                      />
                    </label>
                  </div>
                </section>

                <div className="flex items-center justify-between border-t border-zinc-800 pt-5">
                  <div className="text-sm">
                    {settingsError && <p className="text-red-400">{settingsError}</p>}
                    {settingsSuccess && <p className="text-emerald-400">{settingsSuccess}</p>}
                  </div>
                  <Button type="submit" disabled={updateProject.isPending}>
                    {updateProject.isPending ? "Сохранение..." : "Сохранить настройки"}
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="tokens">
        <ProjectSettingsTokens projectId={id} />
      </TabsContent>

      <TabsContent value="scans">
        <ProjectScans projectId={id} />
      </TabsContent>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Добавить участника</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Поиск пользователя" value={q} onChange={(e) => setQ(e.target.value)} />
            <div className="max-h-48 space-y-1 overflow-auto">
              {(searchUsers.data ?? []).map((u) => (
                <button
                  key={u.id}
                  className={`w-full rounded border px-2 py-1 text-left hover:bg-zinc-800 ${
                    selectedUser === u.id ? "border-red-700 bg-red-950/30" : "border-zinc-800"
                  }`}
                  onClick={() => setSelectedUser(u.id)}
                >
                  <div>{u.full_name || "Без имени"}</div>
                  <div className="text-xs text-zinc-400">{u.email}</div>
                </button>
              ))}
            </div>
            <Button disabled={!selectedUser} onClick={() => addMember.mutate()}>Добавить</Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="hidden">
        <Link to="/projects" />
      </div>
    </Tabs>
  );
}
