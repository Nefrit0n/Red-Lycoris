import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Loader2, Folder } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useProjects, useCreateProject } from "@/api/projects";
import { formatDistanceToNow } from "date-fns";

export default function ProjectsList() {
  const navigate = useNavigate();
  const { data, isLoading } = useProjects();
  const projects = data?.data ?? [];

  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const createProject = useCreateProject();

  const handleCreate = useCallback(() => {
    if (!name.trim()) return;
    const tags = tagsInput
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    createProject.mutate(
      { name: name.trim(), description: description.trim(), tags },
      {
        onSuccess: () => {
          setShowCreate(false);
          setName("");
          setDescription("");
          setTagsInput("");
        },
      },
    );
  }, [name, description, tagsInput, createProject]);

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-40 bg-zinc-800/50" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-zinc-400">
          <span className="font-medium text-zinc-200">{projects.length}</span>{" "}
          project{projects.length !== 1 ? "s" : ""}
        </span>
        <Button
          onClick={() => setShowCreate(true)}
          className="bg-violet-600 text-white hover:bg-violet-700"
          size="sm"
        >
          <Plus className="size-4" />
          New Project
        </Button>
      </div>

      {/* Grid */}
      {projects.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-zinc-800 text-zinc-500">
          <Folder className="size-10 text-zinc-700" />
          <p className="text-sm">No projects yet</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowCreate(true)}
            className="border-zinc-700 text-zinc-300"
          >
            Create your first project
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <Card
              key={p.id}
              className="cursor-pointer border-zinc-800 bg-zinc-900/50 transition-colors hover:border-zinc-700 hover:bg-zinc-900/80"
              onClick={() => navigate(`/findings?project_id=${p.id}`)}
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-base text-zinc-200">
                  {p.name}
                </CardTitle>
                {p.description && (
                  <CardDescription className="line-clamp-2 text-zinc-500">
                    {p.description}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent>
                {p.tags.length > 0 && (
                  <div className="mb-3 flex flex-wrap gap-1.5">
                    {p.tags.map((tag) => (
                      <Badge
                        key={tag}
                        variant="secondary"
                        className="bg-zinc-800 text-xs text-zinc-400"
                      >
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
                <p className="text-xs text-zinc-600">
                  Updated{" "}
                  {formatDistanceToNow(new Date(p.updated_at), {
                    addSuffix: true,
                  })}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="border-zinc-700 bg-zinc-900">
          <DialogHeader>
            <DialogTitle className="text-zinc-100">Create Project</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="mb-1 block text-xs text-zinc-500">
                Name <span className="text-red-400">*</span>
              </label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="My Project"
                className="border-zinc-700 bg-zinc-800 text-zinc-200"
                autoFocus
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-zinc-500">
                Description
              </label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description"
                className="border-zinc-700 bg-zinc-800 text-zinc-200"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-zinc-500">
                Tags (comma-separated)
              </label>
              <Input
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="backend, api, production"
                className="border-zinc-700 bg-zinc-800 text-zinc-200"
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose
              render={
                <Button variant="ghost" className="text-zinc-400" />
              }
            >
              Cancel
            </DialogClose>
            <Button
              onClick={handleCreate}
              disabled={!name.trim() || createProject.isPending}
              className="bg-violet-600 text-white hover:bg-violet-700"
            >
              {createProject.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : null}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
