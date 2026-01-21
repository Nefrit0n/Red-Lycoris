import { useCallback, useState } from "react";
import { addFindingComment } from "../clients/findingsClient";

type CommentState = "idle" | "saving" | "error";

interface UseFindingCommentsOptions {
  findingId: string;
  onSuccess?: () => void;
}

interface UseFindingCommentsResult {
  comment: string;
  commentState: CommentState;
  commentError: string | null;
  setComment: (value: string) => void;
  handleAddComment: () => Promise<void>;
}

/**
 * Custom hook for managing finding comments
 */
export function useFindingComments({
  findingId,
  onSuccess,
}: UseFindingCommentsOptions): UseFindingCommentsResult {
  const [comment, setComment] = useState("");
  const [commentState, setCommentState] = useState<CommentState>("idle");
  const [commentError, setCommentError] = useState<string | null>(null);

  const handleAddComment = useCallback(async () => {
    if (!comment.trim()) return;

    setCommentState("saving");
    setCommentError(null);

    try {
      await addFindingComment(findingId, comment.trim());
      setComment("");
      setCommentState("idle");
      if (onSuccess) {
        await onSuccess();
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Не удалось добавить комментарий";
      setCommentError(msg);
      setCommentState("error");
    }
  }, [findingId, comment, onSuccess]);

  return {
    comment,
    commentState,
    commentError,
    setComment,
    handleAddComment,
  };
}
