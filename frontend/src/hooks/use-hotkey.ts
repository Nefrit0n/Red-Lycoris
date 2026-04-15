import { useEffect, useRef } from "react";

type HotkeyHandler = (event: KeyboardEvent) => void;

interface HotkeyOptions {
  // When true, the hotkey still fires even if the user is typing in an
  // <input>/<textarea>/contenteditable. Default false so we don't hijack
  // keystrokes inside form fields (like pressing "/" to add a slash).
  allowInEditable?: boolean;
  enabled?: boolean;
}

// Tiny keydown hook used to wire page-level shortcuts. A stable callback ref
// lets consumers pass inline arrow functions without resubscribing every
// render. The key match is case-insensitive on `event.key`, so consumers pass
// values like "/", "Escape", "k".
export function useHotkey(
  key: string,
  handler: HotkeyHandler,
  options: HotkeyOptions = {},
) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  const { allowInEditable = false, enabled = true } = options;

  useEffect(() => {
    if (!enabled) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== key) return;

      if (!allowInEditable) {
        const target = event.target as HTMLElement | null;
        const tag = target?.tagName;
        const editable =
          tag === "INPUT" ||
          tag === "TEXTAREA" ||
          tag === "SELECT" ||
          target?.isContentEditable;
        if (editable) return;
      }

      handlerRef.current(event);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [key, enabled, allowInEditable]);
}

export default useHotkey;
