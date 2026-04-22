import { Highlight, themes, type Language } from "prism-react-renderer";

import { cn } from "@/lib/utils";

interface CodeSnippetProps {
  code: string;
  language?: Language | string;
  filePath?: string;
  highlightLine?: number;
  // The first logical line number the snippet represents — used so the gutter
  // numbering lines up with `file_path:line_start` when we display a slice.
  startLine?: number;
  className?: string;
  maxHeight?: number | string;
}

// Map common file extensions to Prism language keys. Kept intentionally small
// — we don't want to pull in exotic grammars when the file extension is
// unknown; prism-react-renderer falls back to plain text in that case.
const EXTENSION_LANGUAGE: Record<string, Language> = {
  py: "python" as Language,
  go: "go" as Language,
  js: "javascript" as Language,
  jsx: "jsx" as Language,
  ts: "tsx" as Language,
  tsx: "tsx" as Language,
  json: "json" as Language,
  yaml: "yaml" as Language,
  yml: "yaml" as Language,
  tf: "hcl" as Language,
  hcl: "hcl" as Language,
  sh: "bash" as Language,
  bash: "bash" as Language,
  sql: "sql" as Language,
  rb: "ruby" as Language,
  php: "php" as Language,
  rs: "rust" as Language,
  java: "java" as Language,
  kt: "kotlin" as Language,
  swift: "swift" as Language,
  c: "c" as Language,
  h: "c" as Language,
  cpp: "cpp" as Language,
  hpp: "cpp" as Language,
  cs: "csharp" as Language,
  html: "markup" as Language,
  xml: "markup" as Language,
  md: "markdown" as Language,
  dockerfile: "docker" as Language,
};

function detectLanguage(
  explicit: CodeSnippetProps["language"],
  filePath: string | undefined,
): Language {
  if (explicit) return explicit as Language;
  if (!filePath) return "text" as Language;

  const clean = filePath.split("?")[0].split("#")[0];
  const base = clean.split("/").pop() ?? clean;

  // Handle well-known filenames with no extension first.
  const lower = base.toLowerCase();
  if (lower === "dockerfile") return "docker" as Language;
  if (lower === "makefile") return "makefile" as Language;

  const dot = base.lastIndexOf(".");
  if (dot === -1 || dot === base.length - 1) return "text" as Language;
  const ext = base.slice(dot + 1).toLowerCase();
  return EXTENSION_LANGUAGE[ext] ?? ("text" as Language);
}

export function CodeSnippet({
  code,
  language,
  filePath,
  highlightLine,
  startLine = 1,
  className,
  maxHeight,
}: CodeSnippetProps) {
  const resolved = detectLanguage(language, filePath);
  const trimmed = code.replace(/\s+$/s, "");

  return (
    <div
      className={cn(
        "overflow-auto rounded-md border border-zinc-800 bg-zinc-950 font-mono text-xs",
        className,
      )}
      style={maxHeight ? { maxHeight } : undefined}
    >
      <Highlight code={trimmed} language={resolved} theme={themes.vsDark}>
        {({ className: preClass, style, tokens, getLineProps, getTokenProps }) => (
          <pre
            className={cn(preClass, "m-0 p-0 text-[12px] leading-[1.45]")}
            style={{ ...style, background: "transparent" }}
          >
            {tokens.map((line, i) => {
              const absLine = startLine + i;
              const isHit = highlightLine === absLine;
              const lineProps = getLineProps({ line });
              return (
                <div
                  key={i}
                  {...lineProps}
                  className={cn(
                    "flex min-w-full whitespace-pre",
                    lineProps.className,
                  )}
                  style={{
                    ...lineProps.style,
                    backgroundColor: isHit ? "rgba(220, 38, 38, 0.18)" : undefined,
                    borderLeft: isHit
                      ? "2px solid rgb(248 113 113)"
                      : "2px solid transparent",
                  }}
                >
                  <span className="inline-block w-10 shrink-0 select-none pr-3 text-right text-zinc-600">
                    {absLine}
                  </span>
                  <span className="pl-2">
                    {line.map((token, key) => (
                      <span key={key} {...getTokenProps({ token })} />
                    ))}
                  </span>
                </div>
              );
            })}
          </pre>
        )}
      </Highlight>
    </div>
  );
}

export default CodeSnippet;
