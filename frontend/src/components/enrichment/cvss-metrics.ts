export type Severity = "critical" | "high" | "medium" | "low" | "neutral";

export interface MetricValueMeta {
  label: string;
  severity: Severity;
  hint: string;
}

export interface MetricMeta {
  label: string;
  description: string;
  values: Record<string, MetricValueMeta>;
}

export const SEVERITY_CLASSES: Record<Severity, string> = {
  critical: "border-red-700/60 bg-red-950/60 text-red-300",
  high: "border-orange-700/60 bg-orange-950/60 text-orange-300",
  medium: "border-amber-700/60 bg-amber-950/60 text-amber-300",
  low: "border-emerald-700/60 bg-emerald-950/60 text-emerald-300",
  neutral: "border-zinc-700 bg-zinc-900/60 text-zinc-300",
};

export function severityFromScore(score: number): Severity {
  if (score >= 9.0) return "critical";
  if (score >= 7.0) return "high";
  if (score >= 4.0) return "medium";
  if (score > 0) return "low";
  return "neutral";
}

export const URGENCY_TO_SEVERITY: Record<string, Severity> = {
  overdue: "critical",
  imminent: "critical",
  high: "high",
  normal: "medium",
  low: "low",
  no_deadline: "neutral",
};

export const CVSS31_METRICS: Record<string, MetricMeta> = {
  AV: {
    label: "Вектор атаки",
    description: "Откуда злоумышленник может проэксплуатировать уязвимость.",
    values: {
      N: { label: "Сеть", severity: "critical", hint: "Атакуется по сети — публичный интернет." },
      A: { label: "Соседняя сеть", severity: "high", hint: "Требуется доступ в локальную/смежную сеть." },
      L: { label: "Локально", severity: "medium", hint: "Нужен доступ к ОС (терминал, SSH)." },
      P: { label: "Физически", severity: "low", hint: "Нужен физический доступ к устройству." },
    },
  },
  AC: {
    label: "Сложность атаки",
    description: "Насколько сложно успешно провести атаку.",
    values: {
      L: { label: "Низкая", severity: "high", hint: "Условия эксплуатации простые и стабильные." },
      H: { label: "Высокая", severity: "low", hint: "Нужны специфические условия или редкие обстоятельства." },
    },
  },
  PR: {
    label: "Привилегии",
    description: "Какие права нужны атакующему до начала эксплуатации.",
    values: {
      N: { label: "Не нужны", severity: "critical", hint: "Атакующий может стартовать без учётной записи." },
      L: { label: "Низкие", severity: "medium", hint: "Достаточно обычных пользовательских прав." },
      H: { label: "Высокие", severity: "low", hint: "Требуются повышенные привилегии." },
    },
  },
  UI: {
    label: "Взаимодействие пользователя",
    description: "Требуется ли участие пользователя для успешной атаки.",
    values: {
      N: { label: "Не требуется", severity: "critical", hint: "Атака выполняется полностью автоматически." },
      R: { label: "Требуется", severity: "medium", hint: "Нужно действие жертвы (клик, открытие файла и т.д.)." },
    },
  },
  S: {
    label: "Область влияния",
    description: "Выходит ли эффект уязвимости за границы уязвимого компонента.",
    values: {
      U: { label: "Не выходит", severity: "low", hint: "Воздействие ограничено текущим компонентом." },
      C: { label: "Выходит", severity: "high", hint: "Атака может затронуть другие компоненты/контексты." },
    },
  },
  C: {
    label: "Конфиденциальность",
    description: "Влияние на раскрытие данных.",
    values: {
      H: { label: "Высокое", severity: "critical", hint: "Возможна утечка критичных данных." },
      L: { label: "Низкое", severity: "medium", hint: "Частичное раскрытие информации." },
      N: { label: "Нет", severity: "low", hint: "Конфиденциальность не нарушается." },
    },
  },
  I: {
    label: "Целостность",
    description: "Влияние на корректность и неизменность данных.",
    values: {
      H: { label: "Высокое", severity: "critical", hint: "Возможна неконтролируемая модификация данных." },
      L: { label: "Низкое", severity: "medium", hint: "Частичное изменение данных." },
      N: { label: "Нет", severity: "low", hint: "Целостность не нарушается." },
    },
  },
  A: {
    label: "Доступность",
    description: "Влияние на доступность сервиса/системы.",
    values: {
      H: { label: "Высокое", severity: "critical", hint: "Полный отказ сервиса или существенная деградация." },
      L: { label: "Низкое", severity: "medium", hint: "Ограниченная деградация доступности." },
      N: { label: "Нет", severity: "low", hint: "На доступность влияние отсутствует." },
    },
  },
};

export const CVSS40_METRICS: Record<string, MetricMeta> = {
  ...CVSS31_METRICS,
  AT: {
    label: "Условия атаки",
    description: "Нужны ли дополнительные условия среды для атаки.",
    values: {
      N: { label: "Не нужны", severity: "high", hint: "Атаку можно провести без особых условий." },
      P: { label: "Особые условия", severity: "low", hint: "Требуются специфические обстоятельства эксплуатации." },
    },
  },
  UI: {
    label: "Взаимодействие пользователя",
    description: "Тип участия пользователя для успешной эксплуатации.",
    values: {
      N: { label: "Не требуется", severity: "critical", hint: "Атака не зависит от действий пользователя." },
      P: { label: "Пассивное", severity: "high", hint: "Достаточно пассивного поведения пользователя." },
      A: { label: "Активное", severity: "medium", hint: "Нужны активные действия пользователя." },
    },
  },
  VC: {
    label: "Конфиденциальность (уязвимая система)",
    description: "Влияние на конфиденциальность в уязвимой системе.",
    values: CVSS31_METRICS.C.values,
  },
  VI: {
    label: "Целостность (уязвимая система)",
    description: "Влияние на целостность в уязвимой системе.",
    values: CVSS31_METRICS.I.values,
  },
  VA: {
    label: "Доступность (уязвимая система)",
    description: "Влияние на доступность в уязвимой системе.",
    values: CVSS31_METRICS.A.values,
  },
  SC: {
    label: "Конфиденциальность (другая система)",
    description: "Влияние на последующие/связанные системы.",
    values: CVSS31_METRICS.C.values,
  },
  SI: {
    label: "Целостность (другая система)",
    description: "Влияние на целостность последующих/связанных систем.",
    values: CVSS31_METRICS.I.values,
  },
  SA: {
    label: "Доступность (другая система)",
    description: "Влияние на доступность последующих/связанных систем.",
    values: CVSS31_METRICS.A.values,
  },
};

export const CVSS_V2_METRICS: Record<string, MetricMeta> = {
  AV: {
    label: "Вектор атаки",
    description: "Откуда возможна атака в модели CVSS 2.0.",
    values: {
      N: { label: "Сеть", severity: "critical", hint: "Удалённая атака по сети." },
      A: { label: "Смежная сеть", severity: "high", hint: "Нужен доступ к локальной/смежной сети." },
      L: { label: "Локально", severity: "medium", hint: "Нужен локальный доступ к системе." },
    },
  },
  AC: {
    label: "Сложность атаки",
    description: "Насколько легко воспроизвести атаку.",
    values: {
      L: { label: "Низкая", severity: "high", hint: "Атака выполняется относительно просто." },
      M: { label: "Средняя", severity: "medium", hint: "Нужны дополнительные условия." },
      H: { label: "Высокая", severity: "low", hint: "Сложная эксплуатация, редкие предпосылки." },
    },
  },
  Au: {
    label: "Аутентификация",
    description: "Сколько раз и на каком уровне нужен вход в систему.",
    values: {
      N: { label: "Не требуется", severity: "critical", hint: "Атакующему не нужна аутентификация." },
      S: { label: "Один экземпляр", severity: "medium", hint: "Нужна одна успешная аутентификация." },
      M: { label: "Множественная", severity: "low", hint: "Требуются многократные шаги аутентификации." },
    },
  },
  C: {
    label: "Конфиденциальность",
    description: "Влияние на раскрытие данных в CVSS 2.0.",
    values: {
      C: { label: "Полный доступ", severity: "critical", hint: "Полное раскрытие чувствительных данных." },
      P: { label: "Частичный", severity: "medium", hint: "Частичная утечка информации." },
      N: { label: "Нет", severity: "low", hint: "Влияния на конфиденциальность нет." },
    },
  },
  I: {
    label: "Целостность",
    description: "Влияние на изменение данных в CVSS 2.0.",
    values: {
      C: { label: "Полное изменение", severity: "critical", hint: "Полная потеря целостности." },
      P: { label: "Частичное", severity: "medium", hint: "Ограниченная модификация данных." },
      N: { label: "Нет", severity: "low", hint: "Целостность не нарушена." },
    },
  },
  A: {
    label: "Доступность",
    description: "Влияние на отказ/деградацию сервиса в CVSS 2.0.",
    values: {
      C: { label: "Полный отказ", severity: "critical", hint: "Сервис полностью недоступен." },
      P: { label: "Частичный", severity: "medium", hint: "Частичная деградация доступности." },
      N: { label: "Нет", severity: "low", hint: "Нет влияния на доступность." },
    },
  },
};
