import { Tooltip } from "@/components/ui/tooltip";

interface Props {
  mfaEnabled: boolean;
  isSystemAccount: boolean;
}

export function MfaCell({ mfaEnabled, isSystemAccount }: Props) {
  if (isSystemAccount) {
    return (
      <span className="text-xs text-muted-foreground select-none" aria-label="—">
        —
      </span>
    );
  }

  return (
    <Tooltip content={mfaEnabled ? "MFA включена" : "MFA не настроена"}>
      <span
        className="text-base leading-none select-none cursor-default"
        aria-label={mfaEnabled ? "MFA включена" : "MFA не настроена"}
        style={{ color: mfaEnabled ? "var(--status-active-dot)" : "var(--muted-foreground)" }}
      >
        {mfaEnabled ? "🔒" : "🔓"}
      </span>
    </Tooltip>
  );
}
