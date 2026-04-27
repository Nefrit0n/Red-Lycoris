import { useMemo } from "react";

export type StrengthLevel = 0 | 1 | 2 | 3 | 4;

export interface PasswordStrength {
  score: StrengthLevel;
  label: string;
  color: string;
}

const COMMON = new Set([
  "password", "password1", "password12", "password123",
  "qwerty", "qwerty123", "111111111111", "123456789012",
  "iloveyou", "admin", "welcome", "monkey", "dragon",
]);

function scorePassword(password: string): StrengthLevel {
  if (!password) return 0;
  if (password.length < 8) return 0;
  if (COMMON.has(password.toLowerCase())) return 1;

  let score = 0;
  if (password.length >= 12) score++;
  if (password.length >= 16) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 1) return 1;
  if (score === 2) return 2;
  if (score === 3) return 3;
  return 4;
}

const LABELS: Record<StrengthLevel, string> = {
  0: "Слишком короткий",
  1: "Слабый",
  2: "Средний",
  3: "Хороший",
  4: "Надёжный",
};

const COLORS: Record<StrengthLevel, string> = {
  0: "var(--status-disabled-dot)",
  1: "var(--destructive)",
  2: "var(--status-pending-dot)",
  3: "var(--status-active-dot)",
  4: "oklch(0.58 0.22 152)",
};

export function usePasswordStrength(password: string): PasswordStrength {
  return useMemo(() => {
    const score = scorePassword(password);
    return { score, label: LABELS[score], color: COLORS[score] };
  }, [password]);
}
