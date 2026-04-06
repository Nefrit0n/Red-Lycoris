import { useCallback, useState } from "react";
import { Loader2, CheckCircle, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
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
import ImportUpload, { type ParsedFile } from "@/components/ImportUpload";
import { useProjects, useCreateProject } from "@/api/projects";
import { cn } from "@/lib/utils";

interface ImportResult {
  fileName: string;
  format: string;
  imported: number;
  updated: number;
  errors: { index: number; message: string }[];
}

type ImportState =
  | { phase: "idle" }
  | { phase: "importing"; current: number; total: number; results: ImportResult[] }
  | { phase: "done"; results: ImportResult[] };

export default function Import() {
  const [files, setFiles] = useState<ParsedFile[]>([]);
  const [projectId, setProjectId] = useState<string>("");
  const [importState, setImportState] = useState<ImportState>({ phase: "idle" });
  const [showNewProject, setShowNewProject] = useState(false);

  const { data: projectsData } = useProjects();
  const projects = projectsData?.data ?? [];

  const createProject = useCreateProject();
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");

  const validFiles = files.filter((f) => !f.error);
  const canImport = validFiles.length > 0 && projectId && importState.phase !== "importing";

  const handleCreateProject = useCallback(() => {
    if (!newName.trim()) return;
    createProject.mutate(
      { name: newName.trim(), description: newDesc.trim(), tags: [] },
      {
        onSuccess: (res) => {
          setProjectId(res.data.id);
          setShowNewProject(false);
          setNewName("");
          setNewDesc("");
        },
      },
    );
  }, [newName, newDesc, createProject]);

  const handleImport = useCallback(async () => {
    if (!canImport) return;

    const results: ImportResult[] = [];
    setImportState({ phase: "importing", current: 0, total: validFiles.length, results: [] });

    for (let i = 0; i < validFiles.length; i++) {
      const pf = validFiles[i];
      setImportState({ phase: "importing", current: i + 1, total: validFiles.length, results: [...results] });

      try {
        const res = await fetch(`/api/v1/import?project_id=${projectId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: await pf.file.text(),
        });
        const json = await res.json() as {
          format?: string;
          imported?: number;
          updated?: number;
          errors?: { index: number; message: string }[];
          error?: { message: string };
        };

        if (!res.ok) {
          results.push({
            fileName: pf.file.name,
            format: pf.format,
            imported: 0,
            updated: 0,
            errors: [{ index: 0, message: json.error?.message ?? "Ошибка импорта" }],
          });
        } else {
          results.push({
            fileName: pf.file.name,
            format: json.format ?? pf.format,
            imported: json.imported ?? 0,
            updated: json.updated ?? 0,
            errors: json.errors ?? [],
          });
        }
      } catch {
        results.push({
          fileName: pf.file.name,
          format: pf.format,
          imported: 0,
          updated: 0,
          errors: [{ index: 0, message: "Сетевая ошибка" }],
        });
      }
    }

    setImportState({ phase: "done", results });
  }, [canImport, validFiles, projectId]);

  const handleReset = useCallback(() => {
    setFiles([]);
    setImportState({ phase: "idle" });
  }, []);

  const isImporting = importState.phase === "importing";
  const progressPct =
    isImporting
      ? (importState.current / importState.total) * 100
      : 0;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* File upload */}
      <Card className="border-zinc-800 bg-zinc-900/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-zinc-300">
            Файлы
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ImportUpload
            files={files}
            onFilesChange={setFiles}
            disabled={isImporting}
          />
        </CardContent>
      </Card>

      {/* Project selection */}
      <Card className="border-zinc-800 bg-zinc-900/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-zinc-300">
            Целевой проект
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-3">
          <Select value={projectId} onValueChange={(val: string | null) => {
            if (val === "__new__") {
              setShowNewProject(true);
            } else {
              setProjectId(val ?? "");
            }
          }}>
            <SelectTrigger className="flex-1 border-zinc-700 bg-zinc-900 text-zinc-200">
              <SelectValue placeholder="Выберите проект..." />
            </SelectTrigger>
            <SelectContent className="border-zinc-700 bg-zinc-900">
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id} className="text-zinc-300 focus:bg-zinc-800 focus:text-zinc-100">
                  {p.name}
                </SelectItem>
              ))}
              <SelectItem value="__new__" className="text-red-400 focus:bg-zinc-800 focus:text-red-300">
                + Создать новый проект
              </SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Progress bar */}
      {isImporting && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span>Импорт файла {importState.current} из {importState.total}...</span>
            <span>{Math.round(progressPct)}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
            <div
              className="h-full rounded-full bg-red-600 transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      )}

      {/* Import button */}
      {importState.phase !== "done" && (
        <Button
          onClick={handleImport}
          disabled={!canImport}
          className="w-full bg-red-700 text-white hover:bg-red-800 disabled:opacity-40"
        >
          {isImporting ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Импорт...
            </>
          ) : (
            `Импортировать ${validFiles.length > 0 ? validFiles.length + " файлов" : ""}`
          )}
        </Button>
      )}

      {/* Results */}
      {importState.phase === "done" && (
        <Card className="border-zinc-800 bg-zinc-900/50">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-zinc-300">
              <CheckCircle className="size-4 text-emerald-400" />
              Импорт завершён
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {importState.results.map((r, i) => {
              const hasErrors = r.errors.length > 0;
              return (
                <div
                  key={i}
                  className={cn(
                    "rounded-md border p-3",
                    hasErrors && r.imported === 0
                      ? "border-red-800/50 bg-red-950/10"
                      : "border-zinc-800 bg-zinc-900/30",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-zinc-200">
                      {r.fileName}
                    </span>
                    <span className="text-xs text-zinc-500">{r.format}</span>
                  </div>
                  <div className="mt-1.5 flex gap-4 text-xs">
                    <span className="text-emerald-400">
                      +{r.imported} импортировано
                    </span>
                    <span className="text-blue-400">
                      ~{r.updated} обновлено
                    </span>
                    {hasErrors && (
                      <span className="text-red-400">
                        {r.errors.length} ошибок
                      </span>
                    )}
                  </div>
                  {hasErrors && (
                    <div className="mt-2 space-y-1">
                      {r.errors.slice(0, 5).map((e, ei) => (
                        <div key={ei} className="flex items-start gap-1.5 text-xs text-red-400/80">
                          <AlertTriangle className="mt-0.5 size-3 shrink-0" />
                          <span>#{e.index}: {e.message}</span>
                        </div>
                      ))}
                      {r.errors.length > 5 && (
                        <span className="text-xs text-zinc-600">
                          ...и ещё {r.errors.length - 5}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            <Button
              variant="outline"
              onClick={handleReset}
              className="w-full border-zinc-700 text-zinc-300"
            >
              Импортировать ещё
            </Button>
          </CardContent>
        </Card>
      )}

      {/* New project dialog */}
      <Dialog open={showNewProject} onOpenChange={setShowNewProject}>
        <DialogContent className="border-zinc-700 bg-zinc-900">
          <DialogHeader>
            <DialogTitle className="text-zinc-100">Создать проект</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="mb-1 block text-xs text-zinc-500">Название</label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Название проекта"
                className="border-zinc-700 bg-zinc-800 text-zinc-200"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-zinc-500">Описание</label>
              <Input
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="Описание (опционально)"
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
              Отмена
            </DialogClose>
            <Button
              onClick={handleCreateProject}
              disabled={!newName.trim() || createProject.isPending}
              className="bg-red-700 text-white hover:bg-red-800"
            >
              {createProject.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : null}
              Создать
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
