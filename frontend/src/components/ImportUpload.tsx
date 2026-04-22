import { useCallback, useState } from "react";
import { FileJson, Upload, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

type ParsedFormat = "sarif" | "gitleaks" | "trufflehog" | "generic" | "unknown";

interface ParsedFile {
  file: File;
  format: ParsedFormat;
  findingsCount: number | null;
  error: string | null;
}

interface ImportUploadProps {
  files: ParsedFile[];
  onFilesChange: (files: ParsedFile[]) => void;
  disabled?: boolean;
}

function isTrufflehogLike(value: unknown): value is { SourceMetadata: unknown; DetectorName: unknown } {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return record["SourceMetadata"] != null && typeof record["DetectorName"] === "string";
}

function isGitleaksLike(value: unknown): value is { RuleID: unknown; Commit: unknown; Match: unknown } {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return typeof record["RuleID"] === "string" && typeof record["Commit"] === "string" && typeof record["Match"] === "string";
}

function detectFormat(data: unknown): { format: ParsedFormat; count: number | null } {
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

  if (Array.isArray(data) && data.length > 0 && isTrufflehogLike(data[0])) {
    return { format: "trufflehog", count: data.length };
  }

  if (Array.isArray(data) && data.length > 0 && isGitleaksLike(data[0])) {
    return { format: "gitleaks", count: data.length };
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

function parseTrufflehogNDJSON(text: string): unknown[] | null {
  const trimmed = text.trim();
  if (trimmed === "") {
    return null;
  }

  const normalized = `[${trimmed.replace(/}\s*{/g, "},{")}]`;
  try {
    const parsed = JSON.parse(normalized) as unknown;
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

async function parseFile(file: File): Promise<ParsedFile> {
  const text = await file.text();

  try {
    const data = JSON.parse(text) as unknown;
    const { format, count } = detectFormat(data);
    return { file, format, findingsCount: count, error: null };
  } catch {
    const ndjsonData = parseTrufflehogNDJSON(text);
    if (ndjsonData !== null && ndjsonData.length > 0 && isTrufflehogLike(ndjsonData[0])) {
      return { file, format: "trufflehog", findingsCount: ndjsonData.length, error: null };
    }
    return { file, format: "unknown", findingsCount: null, error: "Invalid JSON" };
  }
}

const formatLabels: Record<ParsedFormat, { label: string; className: string }> = {
  sarif: { label: "SARIF", className: "border-blue-700/50 bg-blue-950/50 text-blue-400" },
  gitleaks: { label: "Gitleaks", className: "border-orange-700/50 bg-orange-950/50 text-orange-400" },
  trufflehog: { label: "TruffleHog", className: "border-amber-700/50 bg-amber-950/50 text-amber-400" },
  generic: { label: "Generic JSON", className: "border-red-800/50 bg-red-950/50 text-red-500" },
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
            ? "border-red-600 bg-red-600/5"
            : "border-zinc-700 bg-zinc-900/30 hover:border-zinc-600 hover:bg-zinc-900/50",
          disabled && "pointer-events-none opacity-50",
        )}
      >
        <Upload className={cn("size-8", dragOver ? "text-red-500" : "text-zinc-500")} />
        <div className="text-center">
          <p className="text-sm font-medium text-zinc-300">
            Перетащите файлы сюда или нажмите для выбора
          </p>
          <p className="mt-1 text-xs text-zinc-500">Поддерживаются JSON и SARIF файлы</p>
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
                      {pf.findingsCount} находок
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
