import { useCallback, useState } from "react";
import { FileJson, Upload, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface ParsedFile {
  file: File;
  format: "sarif" | "generic" | "unknown";
  findingsCount: number | null;
  error: string | null;
}

interface ImportUploadProps {
  files: ParsedFile[];
  onFilesChange: (files: ParsedFile[]) => void;
  disabled?: boolean;
}

function detectFormat(data: unknown): { format: "sarif" | "generic" | "unknown"; count: number | null } {
  if (typeof data !== "object" || data === null) {
    return { format: "unknown", count: null };
  }

  const obj = data as Record<string, unknown>;

  // SARIF detection
  if (obj["$schema"] && typeof obj["$schema"] === "string" && obj["$schema"].includes("sarif")) {
    return { format: "sarif", count: null };
  }
  if (obj["version"] && typeof obj["version"] === "string" && obj["version"].startsWith("2.1") && Array.isArray(obj["runs"])) {
    const runs = obj["runs"] as { results?: unknown[] }[];
    const count = runs.reduce((sum, r) => sum + (r.results?.length ?? 0), 0);
    return { format: "sarif", count };
  }

  // Generic: array of findings or { findings: [...] }
  if (Array.isArray(data)) {
    return { format: "generic", count: data.length };
  }
  if (Array.isArray(obj["findings"])) {
    return { format: "generic", count: (obj["findings"] as unknown[]).length };
  }

  return { format: "unknown", count: null };
}

async function parseFile(file: File): Promise<ParsedFile> {
  try {
    const text = await file.text();
    const data = JSON.parse(text) as unknown;
    const { format, count } = detectFormat(data);
    return { file, format, findingsCount: count, error: null };
  } catch {
    return { file, format: "unknown", findingsCount: null, error: "Invalid JSON" };
  }
}

const formatLabels: Record<string, { label: string; className: string }> = {
  sarif: { label: "SARIF", className: "border-blue-700/50 bg-blue-950/50 text-blue-400" },
  generic: { label: "Generic JSON", className: "border-violet-700/50 bg-violet-950/50 text-violet-400" },
  unknown: { label: "Unknown", className: "border-zinc-600 bg-zinc-800/60 text-zinc-400" },
};

export default function ImportUpload({ files, onFilesChange, disabled }: ImportUploadProps) {
  const [dragOver, setDragOver] = useState(false);

  const processFiles = useCallback(
    async (fileList: FileList | File[]) => {
      const arr = Array.from(fileList).filter(
        (f) => f.type === "application/json" || f.name.endsWith(".json") || f.name.endsWith(".sarif"),
      );
      const parsed = await Promise.all(arr.map(parseFile));
      onFilesChange([...files, ...parsed]);
    },
    [files, onFilesChange],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (!disabled) {
        processFiles(e.dataTransfer.files);
      }
    },
    [disabled, processFiles],
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) {
        processFiles(e.target.files);
        e.target.value = "";
      }
    },
    [processFiles],
  );

  const removeFile = useCallback(
    (index: number) => {
      onFilesChange(files.filter((_, i) => i !== index));
    },
    [files, onFilesChange],
  );

  return (
    <div className="space-y-3">
      {/* Drop zone */}
      <label
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-8 transition-colors",
          dragOver
            ? "border-violet-500 bg-violet-500/5"
            : "border-zinc-700 bg-zinc-900/30 hover:border-zinc-600 hover:bg-zinc-900/50",
          disabled && "pointer-events-none opacity-50",
        )}
      >
        <Upload className={cn("size-8", dragOver ? "text-violet-400" : "text-zinc-500")} />
        <div className="text-center">
          <p className="text-sm font-medium text-zinc-300">
            Drop files here or click to browse
          </p>
          <p className="mt-1 text-xs text-zinc-500">JSON, SARIF files supported</p>
        </div>
        <input
          type="file"
          accept=".json,.sarif"
          multiple
          onChange={handleInputChange}
          className="hidden"
          disabled={disabled}
        />
      </label>

      {/* File list */}
      {files.length > 0 && (
        <div className="space-y-1.5">
          {files.map((pf, i) => (
            <div
              key={`${pf.file.name}-${i}`}
              className="flex items-center gap-3 rounded-md border border-zinc-800 bg-zinc-900/50 px-3 py-2"
            >
              {pf.error ? (
                <AlertCircle className="size-4 shrink-0 text-red-400" />
              ) : (
                <FileJson className="size-4 shrink-0 text-zinc-400" />
              )}
              <span className="min-w-0 flex-1 truncate text-sm text-zinc-300">
                {pf.file.name}
              </span>
              {!pf.error && (
                <>
                  <Badge variant="outline" className={formatLabels[pf.format].className}>
                    {formatLabels[pf.format].label}
                  </Badge>
                  {pf.findingsCount != null && (
                    <span className="text-xs text-zinc-500">
                      {pf.findingsCount} findings
                    </span>
                  )}
                </>
              )}
              {pf.error && (
                <span className="text-xs text-red-400">{pf.error}</span>
              )}
              <button
                onClick={() => removeFile(i)}
                className="text-xs text-zinc-600 hover:text-zinc-400"
                disabled={disabled}
              >
                &times;
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export type { ParsedFile };
