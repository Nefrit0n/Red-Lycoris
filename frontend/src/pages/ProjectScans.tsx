import { useState } from "react";
import { useProjectScans, useScan } from "@/api/project-security";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function ProjectScans({ projectId }: { projectId: string }) {
  const scansQuery = useProjectScans(projectId);
  const [selectedScanId, setSelectedScanId] = useState<string | null>(null);
  const scanQuery = useScan(selectedScanId ?? undefined);

  return (
    <div className="space-y-4">
      <Card className="border-zinc-800 bg-zinc-900">
        <CardHeader><CardTitle>Сканы</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {(scansQuery.data?.data ?? []).map((s) => (
            <button
              key={s.id}
              className="w-full rounded border border-zinc-700 p-3 text-left hover:bg-zinc-800"
              onClick={() => setSelectedScanId(s.id)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span>{new Date(s.started_at).toLocaleString()}</span>
                  <Badge>{s.branch}</Badge>
                  <span className="font-mono">{s.commit_sha.slice(0, 8)}</span>
                  <Badge variant="outline">{s.scanner}</Badge>
                </div>
                <div className="text-sm text-zinc-400">{s.findings_imported}/{s.findings_updated}</div>
              </div>
            </button>
          ))}
        </CardContent>
      </Card>

      {scanQuery.data && (
        <Card className="border-zinc-800 bg-zinc-900">
          <CardHeader><CardTitle>Детали скана</CardTitle></CardHeader>
          <CardContent className="space-y-2 max-h-96 overflow-auto">
            {scanQuery.data.data.findings.map((f: any) => (
              <div key={f.id} className="rounded border border-zinc-700 p-2">
                <div className="flex items-center gap-2">
                  <span>{f.title}</span>
                  {f.is_new && <Badge className="bg-emerald-600">новый</Badge>}
                </div>
                <div className="text-xs text-zinc-400">{f.file_path}:{f.line_start}</div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
