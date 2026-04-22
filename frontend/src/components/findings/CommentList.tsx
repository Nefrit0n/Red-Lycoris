import { useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import { formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";

import { useCurrentUser } from "@/api/auth";
import { useComments, useDeleteComment, useEditComment } from "@/api/comments";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

export default function CommentList({ findingId }: { findingId: string }) {
  const { data: comments = [] } = useComments(findingId);
  const { data: currentUser } = useCurrentUser();
  const editComment = useEditComment(findingId);
  const deleteComment = useDeleteComment(findingId);

  const sortedComments = useMemo(
    () => [...comments].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
    [comments],
  );

  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);
  const now = Date.now();

  return (
    <div className="space-y-3">
      {sortedComments.map((comment) => {
        const authorName = comment.author?.full_name || comment.author?.email || "Unknown";
        const relativeTime = formatDistanceToNow(new Date(comment.created_at), { addSuffix: true, locale: ru });
        const isAuthor = currentUser?.id === comment.author?.id;
        const canEdit = new Date(comment.created_at).getTime() > now - 15 * 60 * 1000;
        const isEditing = editing?.id === comment.id;

        return (
          <div key={comment.id} className="flex gap-3 rounded-md border border-zinc-800 bg-zinc-900/50 p-3">
            <Avatar className="size-8">
              <AvatarFallback>{authorName.slice(0, 2)}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm text-zinc-200">{authorName}</span>
                <span className="text-xs text-zinc-500">{relativeTime}</span>
                {comment.edited && <Badge variant="outline">изменено</Badge>}
              </div>

              {comment.deleted ? (
                <p className="mt-2 text-sm italic text-zinc-500">Комментарий удалён</p>
              ) : isEditing ? (
                <div className="mt-2 space-y-2">
                  <textarea
                    value={editing.text}
                    onChange={(e) => setEditing({ id: comment.id, text: e.target.value })}
                    rows={4}
                    className="w-full rounded-md border border-zinc-700 bg-zinc-900 p-2 text-sm text-zinc-200"
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={async () => {
                        await editComment.mutateAsync({ eventId: comment.id, text: editing.text });
                        setEditing(null);
                      }}
                    >
                      Сохранить
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                      Отмена
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="prose prose-invert mt-2 max-w-none text-sm">
                  <ReactMarkdown rehypePlugins={[rehypeSanitize]} remarkPlugins={[remarkGfm]}>
                    {comment.text}
                  </ReactMarkdown>
                </div>
              )}

              {isAuthor && !comment.deleted && (
                <div className="mt-1 flex gap-2">
                  {canEdit && (
                    <button
                      className="text-xs text-zinc-400 hover:text-zinc-200"
                      onClick={() => setEditing({ id: comment.id, text: comment.text })}
                    >
                      Изменить
                    </button>
                  )}
                  <button
                    className="text-xs text-zinc-400 hover:text-zinc-200"
                    onClick={() => deleteComment.mutate(comment.id)}
                  >
                    Удалить
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })}

      {sortedComments.length === 0 && <div className="text-sm text-zinc-500">Комментариев пока нет</div>}
    </div>
  );
}
