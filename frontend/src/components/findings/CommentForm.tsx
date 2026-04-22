import { useState } from "react";
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";

import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface CommentFormProps {
  onSubmit: (text: string) => Promise<void> | void;
  submitting?: boolean;
}

export default function CommentForm({ onSubmit, submitting = false }: CommentFormProps) {
  const [text, setText] = useState("");

  return (
    <div className="space-y-3 rounded-md border border-zinc-800 bg-zinc-900/50 p-3">
      <Tabs defaultValue="write">
        <TabsList variant="line">
          <TabsTrigger value="write">Написать</TabsTrigger>
          <TabsTrigger value="preview">Превью</TabsTrigger>
        </TabsList>
        <TabsContent value="write" className="mt-3">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={5}
            className="w-full rounded-md border border-zinc-700 bg-zinc-900 p-2 text-sm text-zinc-200"
            placeholder="Введите комментарий..."
          />
        </TabsContent>
        <TabsContent value="preview" className="mt-3">
          <div className="prose prose-invert max-w-none rounded-md border border-zinc-700 bg-zinc-900 p-3 text-sm">
            <ReactMarkdown rehypePlugins={[rehypeSanitize]} remarkPlugins={[remarkGfm]}>
              {text || "_Пусто_"}
            </ReactMarkdown>
          </div>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end">
        <Button
          disabled={submitting || text.trim().length === 0}
          onClick={async () => {
            await onSubmit(text);
            setText("");
          }}
        >
          Отправить
        </Button>
      </div>
    </div>
  );
}
