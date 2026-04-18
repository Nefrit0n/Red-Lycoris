export type WizardStep = 1 | 2 | 3;

export type ProjectVisibility = "private" | "team" | "workspace";
export type InviteRole = "viewer" | "member" | "maintainer";

export interface TemplateSla {
  critical_days?: number;
  high_days?: number;
  medium_days?: number;
  low_days?: number;
}

export interface ProjectTemplate {
  id: string;
  key: string;
  name: string;
  icon_label: string;
  description: string;
  scanners: string[];
  sla: TemplateSla;
}

export interface SourceGit {
  kind: "git";
  provider: "github" | "gitlab" | "bitbucket";
  repo_url: string;
  default_branch: string;
  autoscan_on_push: boolean;
}

export interface SourceSarif {
  kind: "sarif";
  upload_ids: string[];
}

export interface SourceWebhook {
  kind: "webhook";
}

export type ProjectSource = SourceGit | SourceSarif | SourceWebhook | null;

export interface ProjectInvite {
  email: string;
  role: InviteRole;
}

export interface WizardSla {
  use_template: boolean;
  critical_days?: number;
  high_days?: number;
  medium_days?: number;
  low_days?: number;
  notify_before_breach_days: number;
}

export interface ProjectWizardState {
  step: WizardStep;
  name: string;
  slug: string;
  description: string;
  icon_color: string;
  custom_icon_color: string;
  tags: string[];
  tagInput: string;
  template_id: string;
  source: ProjectSource;
  sourceActionCompleted: boolean;
  owner_id: string;
  team_id?: string;
  visibility: ProjectVisibility;
  sla: WizardSla;
  invites: ProjectInvite[];
  inviteInput: string;
  isDirty: boolean;
  updatedAt: number;
}

export const PROJECT_COLOR_PALETTE = [
  "#3B82F6", // info
  "#14B8A6", // teal
  "#FB7185", // coral
  "#EC4899", // pink
  "#8B5CF6", // purple
  "#F59E0B", // amber
];

const CYRILLIC_MAP: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i", й: "y", к: "k", л: "l", м: "m",
  н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sch", ъ: "",
  ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
};

export function slugifyProjectName(name: string): string {
  const lower = name.trim().toLowerCase();
  const transliterated = Array.from(lower)
    .map((ch) => CYRILLIC_MAP[ch] ?? ch)
    .join("");

  return transliterated
    .replace(/[^a-z0-9\s-_]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

export function normalizeTag(tag: string): string {
  return tag
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function isProjectNameFormatValid(name: string): boolean {
  const trimmed = name.trim();
  if (trimmed.length < 3 || trimmed.length > 64) return false;
  return /^[a-zA-Z0-9а-яА-ЯёЁ\s\-_]+$/.test(trimmed);
}

export function createInitialWizardState(ownerId = ""): ProjectWizardState {
  return {
    step: 1,
    name: "",
    slug: "",
    description: "",
    icon_color: PROJECT_COLOR_PALETTE[0],
    custom_icon_color: "",
    tags: [],
    tagInput: "",
    template_id: "",
    source: null,
    sourceActionCompleted: true,
    owner_id: ownerId,
    team_id: undefined,
    visibility: "workspace",
    sla: {
      use_template: true,
      critical_days: 7,
      high_days: 30,
      medium_days: 90,
      low_days: undefined,
      notify_before_breach_days: 3,
    },
    invites: [],
    inviteInput: "",
    isDirty: false,
    updatedAt: Date.now(),
  };
}

export type WizardAction =
  | { type: "SET_STEP"; step: WizardStep }
  | { type: "PATCH"; patch: Partial<ProjectWizardState> }
  | { type: "SET_NAME"; name: string }
  | { type: "SET_TEMPLATE"; template_id: string; templateSla?: TemplateSla }
  | { type: "ADD_TAG"; tag: string }
  | { type: "REMOVE_TAG"; tag: string }
  | { type: "ADD_INVITE"; email: string; role?: InviteRole }
  | { type: "REMOVE_INVITE"; email: string }
  | { type: "RESET"; ownerId: string };

export function hashToPaletteIndex(input: string): number {
  if (!input) return 0;
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash % PROJECT_COLOR_PALETTE.length;
}

export function projectWizardReducer(state: ProjectWizardState, action: WizardAction): ProjectWizardState {
  if (action.type === "RESET") {
    return createInitialWizardState(action.ownerId);
  }

  const applyMutation = (next: ProjectWizardState) => ({
    ...next,
    isDirty: true,
    updatedAt: Date.now(),
  });

  switch (action.type) {
    case "SET_STEP":
      return { ...state, step: action.step };
    case "PATCH":
      return applyMutation({ ...state, ...action.patch });
    case "SET_NAME": {
      const slug = slugifyProjectName(action.name);
      const derivedColor = PROJECT_COLOR_PALETTE[hashToPaletteIndex(slug)];
      return applyMutation({
        ...state,
        name: action.name,
        slug,
        icon_color: state.custom_icon_color ? state.icon_color : derivedColor,
      });
    }
    case "SET_TEMPLATE": {
      const nextSla = state.sla.use_template
        ? {
            ...state.sla,
            critical_days: action.templateSla?.critical_days ?? 7,
            high_days: action.templateSla?.high_days ?? 30,
            medium_days: action.templateSla?.medium_days ?? 90,
            low_days: action.templateSla?.low_days,
          }
        : state.sla;

      return applyMutation({
        ...state,
        template_id: action.template_id,
        sla: nextSla,
      });
    }
    case "ADD_TAG": {
      const normalized = normalizeTag(action.tag);
      if (!normalized) return state;
      if (state.tags.some((t) => t.toLowerCase() === normalized.toLowerCase())) {
        return state;
      }
      return applyMutation({ ...state, tags: [...state.tags, normalized], tagInput: "" });
    }
    case "REMOVE_TAG":
      return applyMutation({ ...state, tags: state.tags.filter((t) => t !== action.tag) });
    case "ADD_INVITE": {
      const email = action.email.trim().toLowerCase();
      if (!email) return state;
      if (state.invites.some((inv) => inv.email === email)) return state;
      return applyMutation({
        ...state,
        invites: [...state.invites, { email, role: action.role ?? "member" }],
        inviteInput: "",
      });
    }
    case "REMOVE_INVITE":
      return applyMutation({ ...state, invites: state.invites.filter((inv) => inv.email !== action.email) });
    default:
      return state;
  }
}

export interface DraftPayload {
  savedAt: number;
  state: ProjectWizardState;
}

export const PROJECT_WIZARD_DRAFT_KEY = "project-wizard-draft";

export function serializeDraft(state: ProjectWizardState): string {
  return JSON.stringify({ savedAt: Date.now(), state } satisfies DraftPayload);
}

export function parseDraft(raw: string | null): DraftPayload | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as DraftPayload;
    if (!parsed?.state || typeof parsed.savedAt !== "number") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}
