import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiDelete, apiGet, apiPatch, apiPost } from "@/api/client";

export interface CommentAuthor {
  id: string;
  email: string;
  full_name: string;
}

export interface FindingComment {
  id: string;
  author?: CommentAuthor;
  text: string;
  created_at: string;
  edited: boolean;
  deleted: boolean;
}

export function useComments(findingId: string) {
  return useQuery({
    enabled: Boolean(findingId),
    queryKey: ["comments", findingId],
    queryFn: async () => {
      const res = await apiGet<{ data: FindingComment[] }>(`/api/v1/findings/${findingId}/comments`);
      return res.data;
    },
  });
}

export function useCreateComment(findingId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (text: string) => apiPost(`/api/v1/findings/${findingId}/comments`, { text }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["comments", findingId] });
      await queryClient.invalidateQueries({ queryKey: ["finding-events", findingId] });
    },
  });
}

export function useEditComment(findingId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ eventId, text }: { eventId: string; text: string }) =>
      apiPatch(`/api/v1/finding-comments/${eventId}`, { text }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["comments", findingId] });
      await queryClient.invalidateQueries({ queryKey: ["finding-events", findingId] });
    },
  });
}

export function useDeleteComment(findingId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (eventId: string) => apiDelete(`/api/v1/finding-comments/${eventId}`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["comments", findingId] });
      await queryClient.invalidateQueries({ queryKey: ["finding-events", findingId] });
    },
  });
}
