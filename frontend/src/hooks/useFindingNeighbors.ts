import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { fetchFindingNeighbors } from "../api/findings";
import { FindingNeighbors } from "../types/findings";
import { buildFindingLink } from "../utils/findingFormatters";

interface UseFindingNeighborsOptions {
  findingId: string;
  returnToProp?: string | null;
  enabled?: boolean;
}

interface UseFindingNeighborsResult {
  neighbors: FindingNeighbors | null;
  neighborsLoading: boolean;
  neighborsError: string | null;
  returnTo: string | null;
  returnToUrl: URL | null;
  returnToParam: string;
  returnToQuery: string;
  handleBackToResults: () => void;
  handleNavigateNeighbor: (neighborId: string) => void;
  buildFindingLinkWithReturn: (findingId: string) => string;
}

/**
 * Custom hook for managing finding neighbors navigation
 */
export function useFindingNeighbors({
  findingId,
  returnToProp,
  enabled = true,
}: UseFindingNeighborsOptions): UseFindingNeighborsResult {
  const location = useLocation();
  const navigate = useNavigate();

  const [neighbors, setNeighbors] = useState<FindingNeighbors | null>(null);
  const [neighborsLoading, setNeighborsLoading] = useState(false);
  const [neighborsError, setNeighborsError] = useState<string | null>(null);

  // Parse returnTo from prop or URL
  const returnTo = useMemo(() => {
    if (returnToProp) return returnToProp;
    const params = new URLSearchParams(location.search);
    const raw = params.get("returnTo");
    if (!raw) return null;
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  }, [location.search, returnToProp]);

  const returnToUrl = useMemo(() => {
    if (!returnTo) return null;
    try {
      return new URL(returnTo, window.location.origin);
    } catch {
      return null;
    }
  }, [returnTo]);

  const returnToParam = returnToUrl ? `${returnToUrl.pathname}${returnToUrl.search}` : "";
  const returnToQuery = returnToUrl?.search.replace(/^\?/, "") ?? "";

  // Fetch neighbors
  useEffect(() => {
    if (!enabled || !returnToUrl) {
      setNeighbors(null);
      return;
    }

    const load = async () => {
      setNeighborsLoading(true);
      setNeighborsError(null);
      try {
        const response = await fetchFindingNeighbors(findingId, returnToQuery);
        setNeighbors(response);
      } catch (e) {
        if (!(e instanceof DOMException && e.name === "AbortError")) {
          setNeighborsError("Не удалось загрузить соседние находки");
        }
      } finally {
        setNeighborsLoading(false);
      }
    };

    load();
  }, [enabled, findingId, returnToQuery, returnToUrl]);

  const handleBackToResults = useCallback(() => {
    if (!returnToUrl) return;
    navigate(`${returnToUrl.pathname}${returnToUrl.search}`);
  }, [navigate, returnToUrl]);

  const handleNavigateNeighbor = useCallback(
    (neighborId: string) => {
      if (!neighborId) return;
      const link = buildFindingLink(neighborId, returnToParam);
      navigate(link);
    },
    [navigate, returnToParam]
  );

  const buildFindingLinkWithReturn = useCallback(
    (id: string) => {
      return buildFindingLink(id, returnToParam);
    },
    [returnToParam]
  );

  return {
    neighbors,
    neighborsLoading,
    neighborsError,
    returnTo,
    returnToUrl,
    returnToParam,
    returnToQuery,
    handleBackToResults,
    handleNavigateNeighbor,
    buildFindingLinkWithReturn,
  };
}
