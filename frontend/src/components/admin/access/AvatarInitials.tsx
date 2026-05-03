/** Deterministic 24px avatar using first initials + hash-based color from palette. */

const PALETTE = [
  { bg: "oklch(0.88 0.12 240)", fg: "oklch(0.32 0.18 240)" }, // blue
  { bg: "oklch(0.88 0.12 292)", fg: "oklch(0.35 0.2 292)" },  // purple
  { bg: "oklch(0.88 0.12 150)", fg: "oklch(0.35 0.18 150)" }, // green
  { bg: "oklch(0.9 0.14 55)", fg: "oklch(0.38 0.2 50)" },     // orange
  { bg: "oklch(0.9 0.1 340)", fg: "oklch(0.38 0.18 340)" },   // pink
  { bg: "oklch(0.88 0.1 178)", fg: "oklch(0.35 0.16 178)" },  // teal
  { bg: "oklch(0.92 0.14 90)", fg: "oklch(0.4 0.2 85)" },     // yellow
  { bg: "oklch(0.86 0.12 265)", fg: "oklch(0.34 0.2 265)" },  // indigo
];

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

interface Props {
  id: string;
  email: string;
  displayName?: string;
  size?: number;
}

export function AvatarInitials({ id, email, displayName, size = 24 }: Props) {
  const colorIdx = hashString(id) % PALETTE.length;
  const color = PALETTE[colorIdx];

  const initials = (() => {
    if (displayName) {
      const parts = displayName.trim().split(/\s+/);
      if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
      return parts[0].slice(0, 2).toUpperCase();
    }
    return email.slice(0, 2).toUpperCase();
  })();

  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full font-semibold select-none"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.38,
        backgroundColor: color.bg,
        color: color.fg,
      }}
    >
      {initials}
    </span>
  );
}

export { PALETTE, hashString };
