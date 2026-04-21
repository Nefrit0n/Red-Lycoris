import { useCallback, useEffect, useMemo, useReducer, useRef, useState, type KeyboardEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Check, Loader2, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useCurrentUser } from "@/api/auth";
import { apiGet, apiPost } from "@/api/client";
import {
  PROJECT_COLOR_PALETTE,
  PROJECT_WIZARD_DRAFT_KEY,
  createInitialWizardState,
  isProjectNameFormatValid,
  isValidEmail,
  normalizeTag,
  parseDraft,
  projectWizardReducer,
  serializeDraft,
  type InviteRole,
  type ProjectTemplate,
  type ProjectVisibility,
  type WizardStep,
} from "@/lib/project-wizard";
import { useCreateProject } from "@/api/projects";

interface WorkspaceMember {
  id: string;
  email: string;
  display_name?: string;
}

interface WorkspaceTeam {
  id: string;
  name: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface StepErrorMap {
  name?: string;
  slug?: string;
  owner?: string;
  sla?: string;
  source?: string;
  generic?: string;
}

const STEP_LABELS: Array<{ step: WizardStep; title: string }> = [
  { step: 1, title: "Основы" },
  { step: 2, title: "Источник" },
  { step: 3, title: "Команда и SLA" },
];

const SOURCE_OPTIONS = [
  { key: "git", label: "Подключить репозиторий" },
  { key: "sarif", label: "Импорт SARIF / JSON" },
  { key: "webhook", label: "CI/CD webhook" },
] as const;

const DIALOG_TITLE_ID = "create-project-title";
const FALLBACK_TEMPLATES: ProjectTemplate[] = [
  {
    id: "web-api",
    key: "web-api",
    name: "Web API",
    icon_label: "API",
    description: "SAST + DAST + SCA + Secrets",
    scanners: ["SAST", "DAST", "SCA", "Secrets"],
    sla: { critical_days: 7, high_days: 30, medium_days: 90 },
  },
  {
    id: "mobile",
    key: "mobile",
    name: "Mobile",
    icon_label: "APP",
    description: "SAST + SCA + Secrets",
    scanners: ["SAST", "SCA", "Secrets"],
    sla: { critical_days: 7, high_days: 30, medium_days: 90 },
  },
  {
    id: "iac",
    key: "iac",
    name: "Infra as Code",
    icon_label: "IaC",
    description: "IaC + Secrets",
    scanners: ["IaC", "Secrets"],
    sla: { critical_days: 7, high_days: 30, medium_days: 90 },
  },
  {
    id: "library",
    key: "library",
    name: "Library/SDK",
    icon_label: "LIB",
    description: "SCA + SAST + Secrets",
    scanners: ["SCA", "SAST", "Secrets"],
    sla: { critical_days: 7, high_days: 30, medium_days: 90 },
  },
];

export function CreateProjectWizardDialog({ open, onOpenChange }: Props) {
  const navigate = useNavigate();
  const { data: currentUser } = useCurrentUser();
  const [state, dispatch] = useReducer(projectWizardReducer, undefined, () =>
    createInitialWizardState(currentUser?.id ?? ""),
  );

  const [templates, setTemplates] = useState<ProjectTemplate[]>([]);
  const [templateLoadError, setTemplateLoadError] = useState<string>("");
  const [slugStatus, setSlugStatus] = useState<"idle" | "checking" | "free" | "taken">("idle");
  const [slugHint, setSlugHint] = useState<string>("");
  const [tagSuggestions, setTagSuggestions] = useState<string[]>([]);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [teams, setTeams] = useState<WorkspaceTeam[]>([]);
  const [ownerQuery, setOwnerQuery] = useState("");
  const [stepErrors, setStepErrors] = useState<StepErrorMap>({});
  const [footerError, setFooterError] = useState("");
  const [showRestoreDraft, setShowRestoreDraft] = useState(false);
  const [creating, setCreating] = useState(false);
  const [sarifFiles, setSarifFiles] = useState<Array<{ id: string; name: string; size: number; findings: number; critical: number }>>([]);
  const [newTeamName, setNewTeamName] = useState("");
  const createProject = useCreateProject();
  const firstInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!currentUser?.id) return;
    dispatch({ type: "PATCH", patch: { owner_id: state.owner_id || currentUser.id } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id]);

  useEffect(() => {
    if (!open) return;
    void apiGet<{ data: ProjectTemplate[] }>("/api/v1/workspace/project-templates")
      .then((res) => {
        setTemplates(res.data);
        setTemplateLoadError("");
        if (!state.template_id && res.data[0]) {
          dispatch({ type: "SET_TEMPLATE", template_id: res.data[0].id, templateSla: res.data[0].sla });
        }
      })
      .catch(() => {
        setTemplates(FALLBACK_TEMPLATES);
        setTemplateLoadError("Не удалось загрузить шаблоны workspace — используются шаблоны по умолчанию");
        if (!state.template_id) {
          dispatch({
            type: "SET_TEMPLATE",
            template_id: FALLBACK_TEMPLATES[0].id,
            templateSla: FALLBACK_TEMPLATES[0].sla,
          });
        }
      });

    void apiGet<{ data: WorkspaceMember[] }>("/api/v1/workspace/members", { q: "" })
      .then((res) => setMembers(res.data))
      .catch(() => setMembers([]));

    void apiGet<{ data: WorkspaceTeam[] }>("/api/v1/workspace/teams")
      .then((res) => setTeams(res.data))
      .catch(() => setTeams([]));
  }, [open, state.template_id]);

  useEffect(() => {
    if (!open) return;
    const draft = parseDraft(window.sessionStorage.getItem(PROJECT_WIZARD_DRAFT_KEY));
    if (!draft) return;
    if (Date.now() - draft.savedAt > 60 * 60 * 1000) return;
    setShowRestoreDraft(true);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (!state.isDirty) return;
    window.sessionStorage.setItem(PROJECT_WIZARD_DRAFT_KEY, serializeDraft(state));
  }, [open, state]);

  useEffect(() => {
    if (!open) return;
    if (!state.slug || !isProjectNameFormatValid(state.name)) {
      setSlugStatus("idle");
      return;
    }
    const t = window.setTimeout(() => {
      setSlugStatus("checking");
      void apiGet<{ data: { available: boolean } }>("/api/v1/projects/check-slug", { slug: state.slug })
        .then((res) => {
          setSlugStatus(res.data.available ? "free" : "taken");
          setSlugHint(res.data.available ? "✓ свободно" : "✗ занято");
        })
        .catch(() => {
          setSlugStatus("idle");
          setSlugHint("");
        });
    }, 400);
    return () => window.clearTimeout(t);
  }, [open, state.slug, state.name]);

  useEffect(() => {
    if (!open) return;
    const prefix = state.tagInput.trim();
    if (!prefix) {
      setTagSuggestions([]);
      return;
    }
    const t = window.setTimeout(() => {
      void apiGet<{ data: string[] }>("/api/v1/workspace/tags", { prefix, limit: "10" })
        .then((res) => setTagSuggestions(res.data))
        .catch(() => setTagSuggestions([]));
    }, 250);
    return () => window.clearTimeout(t);
  }, [open, state.tagInput]);

  useEffect(() => {
    if (!open) return;
    firstInputRef.current?.focus();
  }, [open, state.step]);

  const activeTemplate = useMemo(
    () => templates.find((tpl) => tpl.id === state.template_id) ?? null,
    [templates, state.template_id],
  );

  const initialLetter = state.name.trim().charAt(0).toUpperCase() || "P";

  const filteredMembers = useMemo(() => {
    const q = ownerQuery.trim().toLowerCase();
    if (!q) return members;
    return members.filter((m) =>
      (m.display_name || m.email).toLowerCase().includes(q) || m.email.toLowerCase().includes(q),
    );
  }, [members, ownerQuery]);

  const canContinueStep1 =
    isProjectNameFormatValid(state.name) &&
    slugStatus !== "taken" &&
    Boolean(state.template_id || templates.length === 0);

  const canContinueStep2 = useMemo(() => {
    if (!state.source) return true;
    if (state.source.kind === "sarif") return sarifFiles.length > 0;
    return state.sourceActionCompleted;
  }, [state.source, state.sourceActionCompleted, sarifFiles.length]);

  const isSlaValid = useMemo(() => {
    const items = [state.sla.critical_days, state.sla.high_days, state.sla.medium_days, state.sla.low_days]
      .filter((v) => v !== undefined);
    return items.every((v) => typeof v === "number" && Number.isFinite(v) && v > 0);
  }, [state.sla]);

  const canCreate = Boolean(state.owner_id) && isSlaValid;

  const restoreDraft = useCallback(() => {
    const draft = parseDraft(window.sessionStorage.getItem(PROJECT_WIZARD_DRAFT_KEY));
    if (!draft) return;
    dispatch({ type: "PATCH", patch: draft.state });
    setShowRestoreDraft(false);
  }, []);

  const discardDraft = useCallback(() => {
    window.sessionStorage.removeItem(PROJECT_WIZARD_DRAFT_KEY);
    setShowRestoreDraft(false);
  }, []);

  const handleCancel = useCallback(() => {
    if (state.isDirty && !window.confirm("Есть несохранённые данные. Закрыть визард?")) {
      return;
    }
    window.sessionStorage.removeItem(PROJECT_WIZARD_DRAFT_KEY);
    dispatch({ type: "RESET", ownerId: currentUser?.id ?? "" });
    onOpenChange(false);
    setFooterError("");
  }, [currentUser?.id, onOpenChange, state.isDirty]);

  const validateStep = useCallback((step: WizardStep) => {
    const nextErrors: StepErrorMap = {};
    if (step === 1) {
      if (!isProjectNameFormatValid(state.name)) nextErrors.name = "Название должно быть 3–64 символа";
      if (slugStatus === "taken") nextErrors.slug = "Slug уже занят";
      if (!state.template_id && templates.length > 0) nextErrors.generic = "Выберите шаблон проекта";
    }
    if (step === 2 && state.source && !canContinueStep2) {
      nextErrors.source = "Завершите настройку выбранного источника";
    }
    if (step === 3) {
      if (!state.owner_id) nextErrors.owner = "Owner обязателен";
      if (!isSlaValid) nextErrors.sla = "Проверьте SLA значения";
    }
    setStepErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }, [canContinueStep2, isSlaValid, slugStatus, state, templates.length]);

  const goToStep = useCallback((step: WizardStep) => {
    if (step >= state.step) return;
    dispatch({ type: "SET_STEP", step });
  }, [state.step]);

  const handleNext = useCallback(() => {
    setFooterError("");
    if (!validateStep(state.step)) return;
    if (state.step < 3) {
      dispatch({ type: "SET_STEP", step: (state.step + 1) as WizardStep });
      return;
    }
  }, [state.step, validateStep]);

  const handleCreate = useCallback(async () => {
    if (!validateStep(1) || !validateStep(2) || !validateStep(3)) {
      if (!validateStep(1)) dispatch({ type: "SET_STEP", step: 1 });
      else if (!validateStep(2)) dispatch({ type: "SET_STEP", step: 2 });
      else dispatch({ type: "SET_STEP", step: 3 });
      return;
    }

    setCreating(true);
    setFooterError("");

    const payload = {
      name: state.name.trim(),
      slug: state.slug,
      description: state.description.trim() || undefined,
      icon_color: state.icon_color,
      tags: state.tags,
      template_id: state.template_id,
      source: state.source,
      owner_id: state.owner_id,
      team_id: state.team_id || undefined,
      visibility: state.visibility,
      sla: state.sla,
      invites: state.invites,
    };

    createProject.mutate(payload as never, {
      onSuccess: (res) => {
        window.sessionStorage.removeItem(PROJECT_WIZARD_DRAFT_KEY);
        onOpenChange(false);
        dispatch({ type: "RESET", ownerId: currentUser?.id ?? "" });
        navigate(`/projects/${res.data.id}?tab=tokens`);
      },
      onError: (err: unknown) => {
        const maybeErr = err as { status?: number; message?: string };
        if (maybeErr?.status === 409) {
          dispatch({ type: "SET_STEP", step: 1 });
          setStepErrors({ slug: "Такой slug уже используется" });
          setFooterError("Имя проекта занято. Исправьте и повторите.");
        } else {
          setFooterError(maybeErr?.message ?? "Не удалось создать проект");
        }
      },
      onSettled: () => setCreating(false),
    });
  }, [createProject, currentUser?.id, navigate, onOpenChange, state, validateStep]);

  const onDialogKeyDown = useCallback((event: KeyboardEvent<HTMLDivElement>) => {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      if (state.step === 3) {
        void handleCreate();
      } else {
        handleNext();
      }
      return;
    }

    if (event.key === "ArrowLeft" && state.step > 1) {
      event.preventDefault();
      dispatch({ type: "SET_STEP", step: (state.step - 1) as WizardStep });
      return;
    }

    if (event.key === "ArrowRight" && state.step < 3) {
      const allowed = state.step === 1 ? canContinueStep1 : canContinueStep2;
      if (!allowed) return;
      event.preventDefault();
      dispatch({ type: "SET_STEP", step: (state.step + 1) as WizardStep });
    }
  }, [canContinueStep1, canContinueStep2, handleCreate, handleNext, state.step]);

  const addTagFromInput = useCallback(() => {
    if (!state.tagInput.trim()) return;
    dispatch({ type: "ADD_TAG", tag: state.tagInput });
  }, [state.tagInput]);

  const addInviteFromInput = useCallback(() => {
    const email = state.inviteInput.trim().toLowerCase();
    if (!email || !isValidEmail(email)) return;
    dispatch({ type: "ADD_INVITE", email });
  }, [state.inviteInput]);

  const renderStep1 = () => (
    <div className="space-y-4">
      <div>
        <div className="mb-2 text-sm text-zinc-300">Иконка и цвет</div>
        <div className="flex items-center gap-2">
          {PROJECT_COLOR_PALETTE.map((color) => (
            <button
              key={color}
              type="button"
              className="h-[26px] w-[26px] rounded-[6px] text-xs font-medium text-white"
              style={{
                backgroundColor: color,
                boxShadow: state.icon_color === color ? `0 0 0 2px ${color}` : undefined,
              }}
              onClick={() => dispatch({ type: "PATCH", patch: { icon_color: color, custom_icon_color: "" } })}
            >
              {initialLetter}
            </button>
          ))}
          <label className="flex h-[26px] w-[26px] cursor-pointer items-center justify-center rounded-[6px] border border-dashed border-zinc-500 text-zinc-300">
            +
            <input
              type="color"
              className="sr-only"
              value={state.custom_icon_color || state.icon_color}
              onChange={(e) =>
                dispatch({ type: "PATCH", patch: { icon_color: e.target.value, custom_icon_color: e.target.value } })
              }
            />
          </label>
        </div>
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between text-sm">
          <label className="font-medium text-zinc-200">Название *</label>
          <span
            className={
              slugStatus === "free"
                ? "text-emerald-400"
                : slugStatus === "taken"
                  ? "text-red-400"
                  : "text-zinc-500"
            }
          >
            {slugStatus === "checking" ? "проверка…" : slugHint}
          </span>
        </div>
        <Input
          ref={firstInputRef}
          value={state.name}
          onChange={(e) => dispatch({ type: "SET_NAME", name: e.target.value })}
          className="h-9"
          aria-invalid={Boolean(stepErrors.name || stepErrors.slug)}
          aria-describedby="wizard-name-errors"
        />
        <div className="mt-1 font-mono text-xs text-zinc-500">acme.io/projects/{state.slug || "project-slug"}</div>
        <div id="wizard-name-errors" className="mt-1 text-xs text-red-400" aria-live="polite">
          {stepErrors.name || stepErrors.slug}
        </div>
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between text-sm text-zinc-300">
          <label>Описание</label>
          <span className={state.description.length > 460 ? "text-amber-400" : "text-zinc-500"}>{state.description.length} / 512</span>
        </div>
        <textarea
          value={state.description}
          onChange={(e) => dispatch({ type: "PATCH", patch: { description: e.target.value.slice(0, 512) } })}
          className="min-h-[56px] w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-sky-500"
          rows={2}
        />
      </div>

      <div>
        <label className="mb-1 block text-sm text-zinc-300">Теги</label>
        <div className="min-h-9 rounded-md border border-zinc-700 bg-zinc-950 p-2 focus-within:border-sky-500">
          <div className="flex flex-wrap items-center gap-1">
            {state.tags.map((tag) => (
              <span key={tag} className="inline-flex items-center gap-1 rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-200">
                {tag}
                <button type="button" onClick={() => dispatch({ type: "REMOVE_TAG", tag })}>
                  <X className="size-3" />
                </button>
              </span>
            ))}
            <input
              value={state.tagInput}
              onChange={(e) => dispatch({ type: "PATCH", patch: { tagInput: e.target.value } })}
              onKeyDown={(e) => {
                if (["Enter", "Tab", ","].includes(e.key)) {
                  e.preventDefault();
                  addTagFromInput();
                }
                if (e.key === "Backspace" && !state.tagInput && state.tags.length > 0) {
                  dispatch({ type: "REMOVE_TAG", tag: state.tags[state.tags.length - 1] });
                }
              }}
              className="min-w-[120px] flex-1 bg-transparent text-sm text-zinc-100 outline-none"
              placeholder="Добавить тег и нажмите Enter"
            />
          </div>
        </div>
        {tagSuggestions.length > 0 && (
          <div className="mt-1 text-xs text-zinc-500">
            Предложить: {tagSuggestions.map((suggestion, idx) => (
              <button
                key={suggestion}
                type="button"
                className="text-sky-400"
                onClick={() => dispatch({ type: "ADD_TAG", tag: suggestion })}
              >
                {normalizeTag(suggestion)}{idx < tagSuggestions.length - 1 ? " · " : ""}
              </button>
            ))}
          </div>
        )}
      </div>

      <div>
        <label className="mb-1 block text-sm text-zinc-300">Шаблон проекта</label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {templates.map((tpl) => {
            const selected = tpl.id === state.template_id;
            return (
              <button
                key={tpl.id}
                type="button"
                onClick={() => dispatch({ type: "SET_TEMPLATE", template_id: tpl.id, templateSla: tpl.sla })}
                className={`rounded-md p-2 text-left text-xs ${
                  selected
                    ? "border-2 border-sky-500 bg-sky-500/10 text-sky-300"
                    : "border border-zinc-700 text-zinc-300"
                }`}
              >
                <div className="mb-1 inline-flex h-[22px] w-[28px] items-center justify-center rounded bg-zinc-800 text-[10px]">{tpl.icon_label}</div>
                <div className="font-medium">{tpl.name}</div>
              </button>
            );
          })}
        </div>
        <div className="mt-2 rounded-md border border-sky-500/30 bg-sky-500/10 p-2 text-xs text-sky-200">
          {activeTemplate
            ? `Шаблон ${activeTemplate.name}: включает ${activeTemplate.scanners.join(" + ")}. SLA critical-${activeTemplate.sla.critical_days ?? 7}д / high-${activeTemplate.sla.high_days ?? 30}д / medium-${activeTemplate.sla.medium_days ?? 90}д`
            : templateLoadError || "Выберите шаблон"}
        </div>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-4">
      <h3 className="text-sm font-medium text-zinc-200">Откуда возьмутся findings?</h3>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {SOURCE_OPTIONS.map((option) => {
          const active = state.source?.kind === option.key;
          return (
            <button
              type="button"
              key={option.key}
              className={`rounded-md border p-3 text-left ${active ? "border-sky-500 bg-sky-500/10" : "border-zinc-700"}`}
              onClick={() => {
                if (option.key === "git") {
                  dispatch({
                    type: "PATCH",
                    patch: {
                      source: {
                        kind: "git",
                        provider: "github",
                        repo_url: "",
                        default_branch: "main",
                        autoscan_on_push: true,
                      },
                      sourceActionCompleted: false,
                    },
                  });
                }
                if (option.key === "sarif") {
                  dispatch({ type: "PATCH", patch: { source: { kind: "sarif", upload_ids: [] }, sourceActionCompleted: false } });
                }
                if (option.key === "webhook") {
                  dispatch({ type: "PATCH", patch: { source: { kind: "webhook" }, sourceActionCompleted: false } });
                }
              }}
            >
              <div className="font-medium text-zinc-200">{option.label}</div>
            </button>
          );
        })}
      </div>

      {state.source?.kind === "git" && (
        <div className="space-y-2 rounded-md border border-zinc-700 p-3">
          <div className="flex gap-2">
            {(["github", "gitlab", "bitbucket"] as const).map((provider) => (
              <button
                type="button"
                key={provider}
                className={`rounded border px-2 py-1 text-xs ${state.source?.kind === "git" && state.source.provider === provider ? "border-sky-500 text-sky-300" : "border-zinc-700 text-zinc-400"}`}
                onClick={() => {
                  if (state.source?.kind !== "git") return;
                  dispatch({ type: "PATCH", patch: { source: { ...state.source, provider } } });
                }}
              >
                {provider}
              </button>
            ))}
          </div>
          <Input
            placeholder="https://github.com/org/repo"
            value={state.source.repo_url}
            onChange={(e) => {
              if (state.source?.kind !== "git") return;
              dispatch({ type: "PATCH", patch: { source: { ...state.source, repo_url: e.target.value } } });
            }}
          />
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <input
              type="checkbox"
              checked={state.source.autoscan_on_push}
              onChange={(e) => {
                if (state.source?.kind !== "git") return;
                dispatch({ type: "PATCH", patch: { source: { ...state.source, autoscan_on_push: e.target.checked } } });
              }}
            />
            Автозапуск сканов при push в main
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              if (state.source?.kind !== "git") return;
              dispatch({ type: "PATCH", patch: { sourceActionCompleted: Boolean(state.source.repo_url) } });
            }}
          >
            Подтвердить подключение
          </Button>
        </div>
      )}

      {state.source?.kind === "sarif" && (
        <div className="space-y-2 rounded-md border border-zinc-700 p-3">
          <label className="flex h-[140px] cursor-pointer items-center justify-center rounded-md border border-dashed border-zinc-600 text-center text-xs text-zinc-400 hover:border-sky-500">
            Перетащите файл сюда или кликните для выбора
            <input
              type="file"
              accept=".sarif,.json"
              multiple
              className="sr-only"
              onChange={async (e) => {
                const files = Array.from(e.target.files ?? []);
                const valid = files.filter((file) => file.size <= 50 * 1024 * 1024);
                const preview = valid.map((file, idx) => ({
                  id: `${file.name}-${idx}`,
                  name: file.name,
                  size: file.size,
                  findings: Math.max(5, Math.floor(file.size / 10000)),
                  critical: Math.max(0, Math.floor(file.size / 2000000)),
                }));
                setSarifFiles(preview);
                if (state.source?.kind === "sarif") {
                  const uploadIds = preview.map((item) => item.id);
                  dispatch({ type: "PATCH", patch: { source: { ...state.source, upload_ids: uploadIds }, sourceActionCompleted: uploadIds.length > 0 } });
                }
              }}
            />
          </label>
          {sarifFiles.map((f) => (
            <div key={f.id} className="rounded border border-zinc-800 p-2 text-xs text-zinc-300">
              {f.name}: найдено {f.findings} findings, {f.critical} critical.
            </div>
          ))}
        </div>
      )}

      {state.source?.kind === "webhook" && (
        <div className="space-y-2 rounded-md border border-zinc-700 p-3 text-xs text-zinc-300">
          <Button
            type="button"
            variant="outline"
            onClick={async () => {
              try {
                await apiPost("/api/v1/projects/temp/ingest-token", {});
              } finally {
                dispatch({ type: "PATCH", patch: { sourceActionCompleted: true } });
              }
            }}
          >
            Выпустить токен
          </Button>
          <pre className="overflow-auto rounded bg-zinc-950 p-2 text-[11px] text-zinc-400">curl -X POST https://acme.io/api/v1/ingest/{'{token}'} -F "report=@results.sarif"</pre>
        </div>
      )}

      <button
        type="button"
        className="text-sm text-sky-400"
        onClick={() => {
          dispatch({ type: "PATCH", patch: { source: null, sourceActionCompleted: true } });
          dispatch({ type: "SET_STEP", step: 3 });
        }}
      >
        Пропустить и настроить позже →
      </button>
      <div className="text-xs text-red-400" aria-live="polite">{stepErrors.source}</div>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-4">
      <div>
        <label className="mb-1 block text-sm text-zinc-300">Owner *</label>
        <Input value={ownerQuery} onChange={(e) => setOwnerQuery(e.target.value)} placeholder="Поиск участника" />
        <div className="mt-2 max-h-28 space-y-1 overflow-auto rounded-md border border-zinc-700 p-2">
          {filteredMembers.map((m) => (
            <button
              key={m.id}
              type="button"
              className={`flex w-full items-center justify-between rounded px-2 py-1 text-left text-xs ${state.owner_id === m.id ? "bg-sky-500/10 text-sky-300" : "text-zinc-300"}`}
              onClick={() => dispatch({ type: "PATCH", patch: { owner_id: m.id } })}
            >
              <span>{m.display_name || m.email}</span>
              <span className="text-zinc-500">{m.email}</span>
            </button>
          ))}
        </div>
        <div className="mt-1 text-xs text-red-400">{stepErrors.owner}</div>
      </div>

      <div>
        <label className="mb-1 block text-sm text-zinc-300">Команда (опционально)</label>
        <div className="flex gap-2">
          <select
            className="h-9 flex-1 rounded-md border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-100"
            value={state.team_id ?? ""}
            onChange={(e) => dispatch({ type: "PATCH", patch: { team_id: e.target.value || undefined } })}
          >
            <option value="">Без команды</option>
            {teams.map((team) => (
              <option key={team.id} value={team.id}>{team.name}</option>
            ))}
          </select>
          <Input value={newTeamName} onChange={(e) => setNewTeamName(e.target.value)} placeholder="+ Создать команду" />
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              if (!newTeamName.trim()) return;
              const item = { id: crypto.randomUUID(), name: newTeamName.trim() };
              setTeams((prev) => [...prev, item]);
              setNewTeamName("");
              dispatch({ type: "PATCH", patch: { team_id: item.id } });
            }}
          >
            <Plus className="size-4" />
          </Button>
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm text-zinc-300">Видимость</label>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {([
            { key: "private", title: "Приватный", description: "Только owner и приглашённые" },
            { key: "team", title: "Команда", description: "Все члены команды" },
            { key: "workspace", title: "Workspace", description: "Все пользователи workspace" },
          ] as Array<{ key: ProjectVisibility; title: string; description: string }>).map((item) => {
            const disabled = item.key === "team" && !state.team_id;
            return (
              <button
                key={item.key}
                type="button"
                disabled={disabled}
                onClick={() => dispatch({ type: "PATCH", patch: { visibility: item.key } })}
                className={`rounded-md border p-2 text-left text-xs ${state.visibility === item.key ? "border-sky-500 bg-sky-500/10 text-sky-300" : "border-zinc-700 text-zinc-300"} ${disabled ? "opacity-40" : ""}`}
              >
                <div className="font-medium">{item.title}</div>
                <div>{item.description}</div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-2 rounded-md border border-zinc-700 p-3">
        <div className="text-sm font-medium text-zinc-200">Сроки устранения findings</div>
        <div className="grid grid-cols-[1fr_auto_auto] items-center gap-2 text-sm">
          {([
            ["critical_days", "Critical"],
            ["high_days", "High"],
            ["medium_days", "Medium"],
            ["low_days", "Low"],
          ] as const).map(([key, label]) => (
            <>
              <span className="text-zinc-300">{label}</span>
              <Input
                value={(state.sla[key] ?? "") as number | string}
                disabled={state.sla.use_template}
                placeholder={key === "low_days" ? "—" : ""}
                onChange={(e) => dispatch({ type: "PATCH", patch: { sla: { ...state.sla, [key]: e.target.value ? Number(e.target.value) : undefined } } })}
                className="h-8 w-20"
              />
              <span className="text-xs text-zinc-500">дней</span>
            </>
          ))}
        </div>
        <label className="flex items-center gap-2 text-xs text-zinc-300">
          <input
            type="checkbox"
            checked={state.sla.use_template}
            onChange={(e) => dispatch({ type: "PATCH", patch: { sla: { ...state.sla, use_template: e.target.checked } } })}
          />
          Использовать политику из шаблона
        </label>
        <label className="flex items-center gap-2 text-xs text-zinc-300">
          <input
            type="checkbox"
            checked={state.sla.notify_before_breach_days === 3}
            onChange={(e) => dispatch({ type: "PATCH", patch: { sla: { ...state.sla, notify_before_breach_days: e.target.checked ? 3 : 0 } } })}
          />
          Уведомлять owner'а за 3 дня до breach
        </label>
        <div className="text-xs text-red-400">{stepErrors.sla}</div>
      </div>

      <div>
        <label className="mb-1 block text-sm text-zinc-300">Приглашение участников</label>
        <div className="rounded-md border border-zinc-700 p-2">
          <div className="mb-2 flex flex-wrap gap-1">
            {state.invites.map((invite) => (
              <div key={invite.email} className="inline-flex items-center gap-1 rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-200">
                {invite.email}
                <select
                  value={invite.role}
                  onChange={(e) => {
                    const nextRole = e.target.value as InviteRole;
                    dispatch({
                      type: "PATCH",
                      patch: {
                        invites: state.invites.map((item) =>
                          item.email === invite.email ? { ...item, role: nextRole } : item,
                        ),
                      },
                    });
                  }}
                  className="bg-transparent text-[10px]"
                >
                  <option value="viewer">Viewer</option>
                  <option value="member">Member</option>
                  <option value="maintainer">Maintainer</option>
                </select>
                <button type="button" onClick={() => dispatch({ type: "REMOVE_INVITE", email: invite.email })}>
                  <X className="size-3" />
                </button>
              </div>
            ))}
          </div>
          <input
            value={state.inviteInput}
            onChange={(e) => dispatch({ type: "PATCH", patch: { inviteInput: e.target.value } })}
            onKeyDown={(e) => {
              if (["Enter", "Tab", ","].includes(e.key)) {
                e.preventDefault();
                addInviteFromInput();
              }
            }}
            className="w-full bg-transparent text-sm text-zinc-100 outline-none"
            placeholder="email@company.com"
          />
        </div>
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => (nextOpen ? onOpenChange(nextOpen) : handleCancel())}>
      <DialogContent
        role="dialog"
        aria-modal="true"
        aria-labelledby={DIALOG_TITLE_ID}
        showCloseButton={false}
        className="w-[580px] max-w-[calc(100%-2rem)] gap-0 border-zinc-700 bg-zinc-900 p-0 text-zinc-100 sm:max-w-[580px]"
        onKeyDown={onDialogKeyDown}
      >
        <div className="border-b border-zinc-700 px-4 py-3">
          <div className="flex items-center justify-between">
            <h2 id={DIALOG_TITLE_ID} className="text-base font-medium">Создать проект</h2>
            <Button variant="ghost" size="icon-sm" onClick={handleCancel} aria-label="Закрыть">
              <X className="size-4" />
            </Button>
          </div>
          <div className="mt-3 hidden items-center gap-2 sm:flex" role="list">
            {STEP_LABELS.map((item) => {
              const completed = item.step < state.step;
              const active = item.step === state.step;
              return (
                <div key={item.step} className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={!completed}
                    onClick={() => goToStep(item.step)}
                    role="listitem"
                    aria-current={active ? "step" : undefined}
                    className="flex items-center gap-2 disabled:cursor-default"
                  >
                    <span
                      className={`inline-flex size-6 items-center justify-center rounded-full text-xs ${
                        completed
                          ? "bg-emerald-500 text-white"
                          : active
                            ? "bg-sky-500 text-white"
                            : "bg-zinc-700 text-zinc-400"
                      }`}
                    >
                      {completed ? <Check className="size-3" /> : item.step}
                    </span>
                    <span className={active ? "text-sky-300" : completed ? "text-zinc-200" : "text-zinc-500"}>{item.title}</span>
                  </button>
                  {item.step < 3 ? <div className="h-px w-8 bg-zinc-700" /> : null}
                </div>
              );
            })}
          </div>
          <div className="mt-2 text-xs text-zinc-400 sm:hidden">{state.step} / 3</div>
        </div>

        <div className="max-h-[70vh] overflow-auto px-4 py-4">
          {showRestoreDraft && (
            <div className="mb-3 rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-xs text-amber-200">
              У вас есть черновик проекта. Восстановить?
              <div className="mt-1 flex gap-2">
                <Button size="sm" variant="outline" onClick={restoreDraft}>Восстановить</Button>
                <Button size="sm" variant="ghost" onClick={discardDraft}>Игнорировать</Button>
              </div>
            </div>
          )}
          {state.step === 1 && renderStep1()}
          {state.step === 2 && renderStep2()}
          {state.step === 3 && renderStep3()}
        </div>

        <div className="sticky bottom-0 flex items-center justify-between gap-2 border-t border-zinc-700 bg-zinc-900 px-4 py-3">
          <Button variant="outline" onClick={handleCancel} disabled={creating}>Отмена</Button>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              disabled={state.step === 1 || creating}
              onClick={() => dispatch({ type: "SET_STEP", step: (state.step - 1) as WizardStep })}
            >
              Назад
            </Button>
            {state.step < 3 ? (
              <Button
                onClick={handleNext}
                disabled={creating || (state.step === 1 ? !canContinueStep1 : !canContinueStep2)}
                className="bg-sky-600 text-white hover:bg-sky-500"
              >
                Далее
              </Button>
            ) : (
              <Button onClick={() => void handleCreate()} disabled={creating || !canCreate} className="bg-sky-600 text-white hover:bg-sky-500">
                {creating ? <Loader2 className="size-4 animate-spin" /> : null}
                Создать проект
              </Button>
            )}
          </div>
        </div>
        {footerError ? <div className="px-4 pb-3 text-xs text-red-400">{footerError}</div> : null}
      </DialogContent>
    </Dialog>
  );
}
