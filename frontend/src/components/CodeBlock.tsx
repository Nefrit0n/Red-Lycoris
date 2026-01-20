import { Box, IconButton, Stack, Tooltip, Typography } from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import CheckIcon from "@mui/icons-material/Check";
import { useEffect, useRef, useState } from "react";
import hljs from "highlight.js/lib/core";

// Import common languages
import javascript from "highlight.js/lib/languages/javascript";
import typescript from "highlight.js/lib/languages/typescript";
import python from "highlight.js/lib/languages/python";
import java from "highlight.js/lib/languages/java";
import go from "highlight.js/lib/languages/go";
import ruby from "highlight.js/lib/languages/ruby";
import php from "highlight.js/lib/languages/php";
import csharp from "highlight.js/lib/languages/csharp";
import sql from "highlight.js/lib/languages/sql";
import xml from "highlight.js/lib/languages/xml";
import json from "highlight.js/lib/languages/json";
import yaml from "highlight.js/lib/languages/yaml";
import bash from "highlight.js/lib/languages/bash";

// Register languages
hljs.registerLanguage("javascript", javascript);
hljs.registerLanguage("js", javascript);
hljs.registerLanguage("typescript", typescript);
hljs.registerLanguage("ts", typescript);
hljs.registerLanguage("python", python);
hljs.registerLanguage("py", python);
hljs.registerLanguage("java", java);
hljs.registerLanguage("go", go);
hljs.registerLanguage("golang", go);
hljs.registerLanguage("ruby", ruby);
hljs.registerLanguage("rb", ruby);
hljs.registerLanguage("php", php);
hljs.registerLanguage("csharp", csharp);
hljs.registerLanguage("cs", csharp);
hljs.registerLanguage("sql", sql);
hljs.registerLanguage("xml", xml);
hljs.registerLanguage("html", xml);
hljs.registerLanguage("json", json);
hljs.registerLanguage("yaml", yaml);
hljs.registerLanguage("yml", yaml);
hljs.registerLanguage("bash", bash);
hljs.registerLanguage("shell", bash);

interface CodeBlockProps {
  code: string;
  language?: string;
  filename?: string;
  startLine?: number;
  highlightLines?: number[];
  maxHeight?: number | string;
}

// Detect language from filename extension
const detectLanguage = (filename?: string): string | undefined => {
  if (!filename) return undefined;

  const ext = filename.split(".").pop()?.toLowerCase();
  const langMap: Record<string, string> = {
    js: "javascript",
    jsx: "javascript",
    ts: "typescript",
    tsx: "typescript",
    py: "python",
    java: "java",
    go: "go",
    rb: "ruby",
    php: "php",
    cs: "csharp",
    sql: "sql",
    xml: "xml",
    html: "xml",
    json: "json",
    yaml: "yaml",
    yml: "yaml",
    sh: "bash",
    bash: "bash",
  };

  return ext ? langMap[ext] : undefined;
};

const CodeBlock = ({
  code,
  language,
  filename,
  startLine = 1,
  highlightLines = [],
  maxHeight = 400,
}: CodeBlockProps) => {
  const codeRef = useRef<HTMLElement>(null);
  const [copied, setCopied] = useState(false);

  // Detect language from filename if not provided
  const detectedLang = language || detectLanguage(filename);

  useEffect(() => {
    if (codeRef.current) {
      // Reset and re-highlight
      codeRef.current.removeAttribute("data-highlighted");

      if (detectedLang && hljs.getLanguage(detectedLang)) {
        hljs.highlightElement(codeRef.current);
      }
    }
  }, [code, detectedLang]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const lines = code.split("\n");
  const highlightSet = new Set(highlightLines);

  return (
    <Box
      sx={{
        position: "relative",
        borderRadius: 2,
        overflow: "hidden",
        border: "1px solid",
        borderColor: "divider",
        bgcolor: "#1e1e2e",
      }}
    >
      {/* Header */}
      {filename && (
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          sx={{
            px: 1.5,
            py: 0.75,
            bgcolor: "rgba(255, 255, 255, 0.05)",
            borderBottom: "1px solid",
            borderColor: "divider",
          }}
        >
          <Typography
            variant="caption"
            sx={{
              fontFamily: "monospace",
              color: "text.secondary",
              fontWeight: 500,
            }}
          >
            {filename}
          </Typography>
          <Tooltip title={copied ? "Copied!" : "Copy code"}>
            <IconButton size="small" onClick={handleCopy} sx={{ color: "text.secondary" }}>
              {copied ? <CheckIcon fontSize="small" /> : <ContentCopyIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
        </Stack>
      )}

      {/* Code container */}
      <Box
        sx={{
          display: "flex",
          maxHeight,
          overflow: "auto",
          "&::-webkit-scrollbar": {
            width: 8,
            height: 8,
          },
          "&::-webkit-scrollbar-track": {
            bgcolor: "transparent",
          },
          "&::-webkit-scrollbar-thumb": {
            bgcolor: "rgba(255,255,255,0.2)",
            borderRadius: 4,
          },
        }}
      >
        {/* Line numbers */}
        <Box
          sx={{
            flexShrink: 0,
            py: 1.5,
            pl: 1.5,
            pr: 1,
            bgcolor: "rgba(255, 255, 255, 0.02)",
            borderRight: "1px solid",
            borderColor: "rgba(255, 255, 255, 0.06)",
            userSelect: "none",
          }}
        >
          {lines.map((_, idx) => {
            const lineNum = startLine + idx;
            const isHighlighted = highlightSet.has(lineNum);
            return (
              <Box
                key={idx}
                sx={{
                  fontFamily: "monospace",
                  fontSize: "0.75rem",
                  lineHeight: "1.5rem",
                  color: isHighlighted ? "warning.main" : "text.disabled",
                  textAlign: "right",
                  minWidth: 32,
                  fontWeight: isHighlighted ? 700 : 400,
                }}
              >
                {lineNum}
              </Box>
            );
          })}
        </Box>

        {/* Code content */}
        <Box
          sx={{
            flex: 1,
            py: 1.5,
            px: 1.5,
            overflow: "auto",
            position: "relative",
          }}
        >
          {/* Highlighted line backgrounds */}
          {highlightLines.length > 0 && (
            <Box
              sx={{
                position: "absolute",
                top: 12,
                left: 0,
                right: 0,
                pointerEvents: "none",
              }}
            >
              {lines.map((_, idx) => {
                const lineNum = startLine + idx;
                const isHighlighted = highlightSet.has(lineNum);
                return isHighlighted ? (
                  <Box
                    key={idx}
                    sx={{
                      height: "1.5rem",
                      bgcolor: "rgba(255, 193, 7, 0.15)",
                      borderLeft: "3px solid",
                      borderColor: "warning.main",
                      ml: -1.5,
                      pl: 1.5,
                    }}
                  />
                ) : (
                  <Box key={idx} sx={{ height: "1.5rem" }} />
                );
              })}
            </Box>
          )}

          <Box
            component="pre"
            sx={{
              m: 0,
              p: 0,
              position: "relative",
              zIndex: 1,
            }}
          >
            <Box
              component="code"
              ref={codeRef}
              className={detectedLang ? `language-${detectedLang}` : undefined}
              sx={{
                fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
                fontSize: "0.75rem",
                lineHeight: "1.5rem",
                display: "block",
                whiteSpace: "pre",
                color: "#cdd6f4",
                // highlight.js theme overrides for dark mode
                "& .hljs-keyword": { color: "#cba6f7" },
                "& .hljs-string": { color: "#a6e3a1" },
                "& .hljs-number": { color: "#fab387" },
                "& .hljs-comment": { color: "#6c7086", fontStyle: "italic" },
                "& .hljs-function": { color: "#89b4fa" },
                "& .hljs-class": { color: "#f9e2af" },
                "& .hljs-variable": { color: "#f38ba8" },
                "& .hljs-operator": { color: "#89dceb" },
                "& .hljs-punctuation": { color: "#9399b2" },
                "& .hljs-property": { color: "#94e2d5" },
                "& .hljs-attr": { color: "#f9e2af" },
                "& .hljs-tag": { color: "#89b4fa" },
                "& .hljs-name": { color: "#cba6f7" },
                "& .hljs-built_in": { color: "#f38ba8" },
                "& .hljs-type": { color: "#f9e2af" },
                "& .hljs-literal": { color: "#fab387" },
                "& .hljs-params": { color: "#cdd6f4" },
                "& .hljs-meta": { color: "#f5c2e7" },
                "& .hljs-title": { color: "#89b4fa" },
              }}
            >
              {code}
            </Box>
          </Box>
        </Box>
      </Box>

      {/* Copy button for code without filename header */}
      {!filename && (
        <Tooltip title={copied ? "Copied!" : "Copy code"}>
          <IconButton
            size="small"
            onClick={handleCopy}
            sx={{
              position: "absolute",
              top: 8,
              right: 8,
              color: "text.secondary",
              bgcolor: "rgba(0,0,0,0.3)",
              "&:hover": { bgcolor: "rgba(0,0,0,0.5)" },
            }}
          >
            {copied ? <CheckIcon fontSize="small" /> : <ContentCopyIcon fontSize="small" />}
          </IconButton>
        </Tooltip>
      )}
    </Box>
  );
};

export default CodeBlock;
