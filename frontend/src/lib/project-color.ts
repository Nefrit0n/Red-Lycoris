// Stable per-project color picker. We hash the project name (or id) with djb2
// and project the result onto a fixed pastel palette so the same project
// always renders the same chip color without a DB round-trip.

export interface ProjectColor {
  bg: string;
  border: string;
  text: string;
}

// Pastel background + deeper border/text pairs chosen so chips stay legible on
// the app's light card surface. Index order is stable; new entries should be
// appended to keep existing projects on the same slot.
const PALETTE: ProjectColor[] = [
  { bg: "hsl(210 90% 94%)", border: "hsl(210 70% 60%)", text: "hsl(210 70% 30%)" },
  { bg: "hsl(150 65% 92%)", border: "hsl(150 55% 45%)", text: "hsl(150 65% 25%)" },
  { bg: "hsl(280 75% 94%)", border: "hsl(280 55% 60%)", text: "hsl(280 60% 30%)" },
  { bg: "hsl(20 90% 93%)", border: "hsl(20 75% 55%)", text: "hsl(20 75% 30%)" },
  { bg: "hsl(340 85% 94%)", border: "hsl(340 65% 58%)", text: "hsl(340 65% 32%)" },
  { bg: "hsl(45 90% 90%)", border: "hsl(42 70% 45%)", text: "hsl(38 75% 28%)" },
  { bg: "hsl(190 75% 92%)", border: "hsl(190 60% 45%)", text: "hsl(190 70% 25%)" },
  { bg: "hsl(100 60% 92%)", border: "hsl(105 50% 42%)", text: "hsl(105 60% 24%)" },
  { bg: "hsl(255 75% 95%)", border: "hsl(255 55% 62%)", text: "hsl(255 60% 32%)" },
  { bg: "hsl(0 80% 94%)", border: "hsl(0 65% 58%)", text: "hsl(0 65% 32%)" },
  { bg: "hsl(170 60% 92%)", border: "hsl(170 50% 42%)", text: "hsl(170 60% 24%)" },
  { bg: "hsl(310 70% 94%)", border: "hsl(310 55% 58%)", text: "hsl(310 60% 30%)" },
];

function djb2(input: string): number {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash + input.charCodeAt(i)) | 0;
  }
  // Force unsigned 32-bit so the modulo below never returns a negative slot.
  return hash >>> 0;
}

export function projectColor(key: string | null | undefined): ProjectColor {
  const seed = (key ?? "").trim();
  if (!seed) {
    return PALETTE[0];
  }
  const idx = djb2(seed) % PALETTE.length;
  return PALETTE[idx];
}
