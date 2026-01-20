import { useEffect, useCallback } from "react";

interface UseKeyboardNavigationOptions {
  onPrevious?: () => void;
  onNext?: () => void;
  onClose?: () => void;
  enabled?: boolean;
}

/**
 * Hook for keyboard navigation in finding detail views
 * j - go to next finding
 * k - go to previous finding
 * Escape - close (if onClose provided)
 */
export const useKeyboardNavigation = ({
  onPrevious,
  onNext,
  onClose,
  enabled = true,
}: UseKeyboardNavigationOptions) => {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // Don't trigger if user is typing in an input/textarea
      const target = event.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      // Don't trigger if modifier keys are pressed (except for Escape)
      if (event.ctrlKey || event.altKey || event.metaKey) {
        return;
      }

      switch (event.key.toLowerCase()) {
        case "j":
          // j = next (down)
          if (onNext) {
            event.preventDefault();
            onNext();
          }
          break;
        case "k":
          // k = previous (up)
          if (onPrevious) {
            event.preventDefault();
            onPrevious();
          }
          break;
        case "escape":
          if (onClose) {
            event.preventDefault();
            onClose();
          }
          break;
      }
    },
    [onPrevious, onNext, onClose]
  );

  useEffect(() => {
    if (!enabled) return;

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [enabled, handleKeyDown]);
};

export default useKeyboardNavigation;
