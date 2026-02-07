import { ApiError, getAuthHeaders } from "./http";

type SuccessEnvelope = {
  success?: boolean;
  data?: unknown;
  error?: string;
  message?: string;
};

const extractMessage = (payload: unknown, fallback: string) => {
  if (payload && typeof payload === "object") {
    const env = payload as SuccessEnvelope;
    if (typeof env.error === "string" && env.error) return env.error;
    if (typeof env.message === "string" && env.message) return env.message;
  }
  return fallback;
};

const unwrapEnvelope = <T>(payload: unknown): T => {
  if (payload && typeof payload === "object" && "success" in (payload as SuccessEnvelope)) {
    const env = payload as SuccessEnvelope;
    if (env.success === false) {
      throw new ApiError(env.error || env.message || "Ошибка запроса", {
        status: 400,
        code: "SUCCESS_ENVELOPE_ERROR",
        details: payload,
      });
    }
    return (env.data ?? payload) as T;
  }
  return payload as T;
};

export const uploadFormDataWithProgress = async <T>({
  url,
  formData,
  idempotencyKey,
  onProgress,
}: {
  url: string;
  formData: FormData;
  idempotencyKey?: string;
  onProgress?: (progress: number) => void;
}): Promise<T> => {
  return new Promise<T>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url, true);

    const authHeaders = getAuthHeaders();
    Object.entries(authHeaders).forEach(([key, value]) => {
      if (typeof value === "string") {
        xhr.setRequestHeader(key, value);
      }
    });
    if (idempotencyKey) {
      xhr.setRequestHeader("Idempotency-Key", idempotencyKey);
    }

    xhr.upload.onprogress = (event) => {
      if (!onProgress || !event.lengthComputable) return;
      const progress = Math.round((event.loaded / event.total) * 100);
      onProgress(progress);
    };

    xhr.onload = () => {
      const status = xhr.status;
      const text = xhr.responseText || "";
      let payload: unknown = null;
      if (text) {
        try {
          payload = JSON.parse(text);
        } catch {
          payload = text;
        }
      }

      if (status < 200 || status >= 300) {
        const message = extractMessage(payload, xhr.statusText || `HTTP ${status}`);
        reject(new ApiError(message, { status, details: payload }));
        return;
      }

      try {
        const data = unwrapEnvelope<T>(payload);
        resolve(data);
      } catch (err) {
        reject(err);
      }
    };

    xhr.onerror = () => {
      reject(
        new ApiError("Network error", {
          status: 0,
          code: "NETWORK_ERROR",
        })
      );
    };

    xhr.send(formData);
  });
};
