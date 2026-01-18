import { useCallback, useEffect, useState } from "react";
import { updateFindingStatus } from "../api/findings";
import { FindingDetail, FindingStatus } from "../types/findings";

type StatusState = "idle" | "saving" | "saved" | "error";

interface UseFindingStatusOptions {
  initialStatus: FindingStatus;
  findingId: string;
  onSuccess?: (updated: FindingDetail) => void;
}

interface UseFindingStatusResult {
  status: FindingStatus | "";
  statusState: StatusState;
  statusError: string | null;
  statusChanged: boolean;
  setStatus: (status: FindingStatus | "") => void;
  handleStatusUpdate: () => Promise<void>;
}

/**
 * Custom hook for managing finding status updates
 */
export function useFindingStatus({
  initialStatus,
  findingId,
  onSuccess,
}: UseFindingStatusOptions): UseFindingStatusResult {
  const [status, setStatus] = useState<FindingStatus | "">(initialStatus);
  const [statusState, setStatusState] = useState<StatusState>("idle");
  const [statusError, setStatusError] = useState<string | null>(null);

  // Update local status when initial status changes
  useEffect(() => {
    setStatus(initialStatus);
  }, [initialStatus]);

  // Auto-reset saved state after 1.5s
  useEffect(() => {
    if (statusState !== "saved") return;
    const t = window.setTimeout(() => setStatusState("idle"), 1500);
    return () => window.clearTimeout(t);
  }, [statusState]);

  const handleStatusUpdate = useCallback(async () => {
    if (!status) return;

    setStatusState("saving");
    setStatusError(null);

    try {
      const updated = await updateFindingStatus(findingId, status);
      if (onSuccess) {
        onSuccess(updated);
      }
      setStatusState("saved");
    } catch (e) {
      const msg = e instanceof Error && e.message ? e.message : "Не удалось сохранить";
      setStatusError(msg);
      setStatusState("error");
    }
  }, [findingId, status, onSuccess]);

  const statusChanged = status !== "" && status !== initialStatus;

  return {
    status,
    statusState,
    statusError,
    statusChanged,
    setStatus,
    handleStatusUpdate,
  };
}
