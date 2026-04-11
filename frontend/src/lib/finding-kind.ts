import {
  CircleAlert,
  Code,
  Globe,
  Key,
  Package,
  Server,
  type LucideIcon,
} from "lucide-react";

import type { FindingKind } from "@/types";

export const FINDING_KINDS: FindingKind[] = [
  "sca",
  "sast",
  "dast",
  "iac",
  "secrets",
  "other",
];

export interface FindingKindMeta {
  label: string;
  short: string;
  icon: LucideIcon;
  // Chip background + text combo. Icons reuse `text-*` to stay readable.
  chipClass: string;
  // Solid dot/icon-only variant used in dense table rows.
  dotClass: string;
}

export const FINDING_KIND_META: Record<FindingKind, FindingKindMeta> = {
  sca: {
    label: "Компоненты (SCA)",
    short: "SCA",
    icon: Package,
    chipClass: "border-indigo-700/50 bg-indigo-950/40 text-indigo-300",
    dotClass: "text-indigo-400",
  },
  sast: {
    label: "Код (SAST)",
    short: "SAST",
    icon: Code,
    chipClass: "border-violet-700/50 bg-violet-950/40 text-violet-300",
    dotClass: "text-violet-400",
  },
  dast: {
    label: "Веб (DAST)",
    short: "DAST",
    icon: Globe,
    chipClass: "border-cyan-700/50 bg-cyan-950/40 text-cyan-300",
    dotClass: "text-cyan-400",
  },
  iac: {
    label: "Инфраструктура (IaC)",
    short: "IaC",
    icon: Server,
    chipClass: "border-teal-700/50 bg-teal-950/40 text-teal-300",
    dotClass: "text-teal-400",
  },
  secrets: {
    label: "Секреты",
    short: "Secrets",
    icon: Key,
    chipClass: "border-amber-700/50 bg-amber-950/40 text-amber-300",
    dotClass: "text-amber-400",
  },
  other: {
    label: "Прочее",
    short: "Other",
    icon: CircleAlert,
    chipClass: "border-zinc-600 bg-zinc-800/60 text-zinc-400",
    dotClass: "text-zinc-400",
  },
};

export function findingKindMeta(kind: FindingKind | string | undefined): FindingKindMeta {
  if (!kind) return FINDING_KIND_META.other;
  if (kind in FINDING_KIND_META) {
    return FINDING_KIND_META[kind as FindingKind];
  }
  return FINDING_KIND_META.other;
}

export function isFindingKind(value: string): value is FindingKind {
  return FINDING_KINDS.includes(value as FindingKind);
}
