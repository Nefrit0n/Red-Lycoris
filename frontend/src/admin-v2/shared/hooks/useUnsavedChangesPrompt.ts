import { useEffect } from "react";

const useUnsavedChangesPrompt = (
  isDirty: boolean,
  message = "Есть несохранённые изменения. Если уйти, они будут потеряны."
) => {
  useEffect(() => {
    if (!isDirty) {
      return undefined;
    }

    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = message;
      return message;
    };

    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty, message]);
};

export default useUnsavedChangesPrompt;
