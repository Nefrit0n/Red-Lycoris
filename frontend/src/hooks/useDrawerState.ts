import { useCallback, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';

interface UseDrawerStateOptions {
  selectedFindingId: string | null;
  setSelectedFindingId: (id: string | null) => void;
  selectionCount: number;
  listStateKey?: string;
  allowSelectionClose?: boolean;
}

interface UseDrawerStateResult {
  listReturnTo: string;
  openDrawer: (id: string) => void;
  closeDrawer: () => void;
  openInNewTab: () => void;
  handleTableLinkClickCapture: (e: React.MouseEvent) => void;
}

/**
 * Custom hook for managing drawer state and navigation
 */
export function useDrawerState({
  selectedFindingId,
  setSelectedFindingId,
  selectionCount,
  listStateKey = 'lotus_warden_findings_list_state',
  allowSelectionClose = true,
}: UseDrawerStateOptions): UseDrawerStateResult {
  const location = useLocation();

  // Base returnTo without selected param (to avoid re-opening drawer when opening in new tab)
  const listReturnTo = useMemo(() => {
    const params = new URLSearchParams(location.search);
    params.delete('selected');
    const qs = params.toString();
    return `${location.pathname}${qs ? `?${qs}` : ''}`;
  }, [location.pathname, location.search]);

  const openDrawer = useCallback(
    (id: string) => {
      const listPath = `${location.pathname}${location.search}`;
      sessionStorage.setItem(listStateKey, JSON.stringify({ path: listPath, scrollY: window.scrollY }));
      setSelectedFindingId(id);
    },
    [location.pathname, location.search, listStateKey, setSelectedFindingId]
  );

  const closeDrawer = useCallback(() => {
    setSelectedFindingId(null);
  }, [setSelectedFindingId]);

  const openInNewTab = useCallback(() => {
    if (!selectedFindingId) return;
    const url = `/findings/${selectedFindingId}?returnTo=${encodeURIComponent(listReturnTo)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }, [selectedFindingId, listReturnTo]);

  // Close drawer when batch mode is enabled
  useEffect(() => {
    if (!allowSelectionClose) return;
    if (selectionCount > 0 && selectedFindingId) {
      setSelectedFindingId(null);
    }
  }, [allowSelectionClose, selectionCount, selectedFindingId, setSelectedFindingId]);

  // Scroll restore
  useEffect(() => {
    const raw = sessionStorage.getItem(listStateKey);
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw) as { path?: string; scrollY?: number };
      if (parsed.path === `${location.pathname}${location.search}` && typeof parsed.scrollY === 'number') {
        window.requestAnimationFrame(() => {
          window.scrollTo({ top: parsed.scrollY ?? 0, behavior: 'auto' });
        });
      }
    } catch {
      sessionStorage.removeItem(listStateKey);
    }
  }, [listStateKey, location.pathname, location.search]);

  // Intercept clicks on /findings/:id links to open drawer instead of navigating
  const handleTableLinkClickCapture = useCallback(
    (e: React.MouseEvent) => {
      // Respect ctrl/cmd/shift clicks (open in new tab)
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;

      const target = e.target as HTMLElement | null;
      const a = target?.closest('a') as HTMLAnchorElement | null;
      if (!a?.href) return;

      let url: URL;
      try {
        url = new URL(a.href);
      } catch {
        return;
      }

      // Only handle /findings/:id links
      if (!url.pathname.startsWith('/findings/')) return;

      const parts = url.pathname.split('/').filter(Boolean);
      const id = parts[1];
      if (!id) return;

      e.preventDefault();
      e.stopPropagation();
      openDrawer(id);
    },
    [openDrawer]
  );

  return {
    listReturnTo,
    openDrawer,
    closeDrawer,
    openInNewTab,
    handleTableLinkClickCapture,
  };
}
