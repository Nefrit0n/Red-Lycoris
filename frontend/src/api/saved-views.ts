import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { apiDelete, apiGet, apiPatch, apiPost } from "@/api/client";
import type { SavedView } from "@/types";

export const savedViewsKey = ["saved-views"] as const;

interface SavedViewsListResponse {
  data: SavedView[];
}

interface SavedViewResponse {
  data: SavedView;
}

export function useSavedViews() {
  return useQuery({
    queryKey: savedViewsKey,
    queryFn: () => apiGet<SavedViewsListResponse>("/api/v1/saved-views"),
    staleTime: 60_000,
  });
}

export function useCreateSavedView() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; query: Record<string, unknown> }) =>
      apiPost<SavedViewResponse>("/api/v1/saved-views", input),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: savedViewsKey });
    },
  });
}

export function useUpdateSavedView() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      apiPatch<SavedViewResponse>(`/api/v1/saved-views/${id}`, { name }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: savedViewsKey });
    },
  });
}

export function useDeleteSavedView() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDelete(`/api/v1/saved-views/${id}`),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: savedViewsKey });
    },
  });
}
