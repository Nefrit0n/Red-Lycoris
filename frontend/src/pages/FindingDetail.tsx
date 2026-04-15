import { useCallback, type ComponentType, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Clock,
  Eye,
  FileCode,
  GitCommit,
  Globe,
  KeyRound,
  Package,
  Scan,
  Server,
  ExternalLink,
  ChevronDown,
  Loader2,
} from "lucide-react";
import { format, formatDistanceToNow, isValid } from "date-fns";
import { ru } from "date-fns/locale";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import SeverityBadge from "@/components/SeverityBadge";
import StatusBadge from "@/components/StatusBadge";
import PriorityScore from "@/components/PriorityScore";
import EnrichmentTabs from "@/components/EnrichmentTabs";
import CodeSnippet from "@/components/CodeSnippet";
import { useHotkey } from "@/hooks/use-hotkey";
import { useFinding, useUpdateStatus } from "@/api/findings";
import { useFindingScore } from "@/api/enrichment";
import type { Finding } from "@/types";

const statusOptions = [
  { value: 0, label: "Открыта" },
  { value: 1, label: "Подтверждена" },
  { value: 2, label: "Ложное срабатывание" },
  { value: 3, label: "Устранена" },
  { value: 4, label: "Риск принят" },
];

function formatAbsoluteDate(date: string) {
  const parsed = new Date(date);
  if (!isValid(parsed)) return "—";
  return format(parsed, "PPp", { locale: ru });
}

function formatRelativeDate(date: string) {
  const parsed = new Date(date);
  if (!isValid(parsed)) return "—";
  return formatDistanceToNow(parsed, { addSuffix: true, locale: ru });
}

function normalizeCweId(raw: string | number) {
  const value = String(raw).trim().toUpperCase();
  return value.startsWith("CWE-") ? value.slice(4) : value;
}

function DetailRow({
  icon: Icon,
  label,
  children,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="mt-0.5 size-4 shrink-0 text-zinc-500" />
      <div className="min-w-0">
        <div className="text-xs text-zinc-500">{label}</div>
        <div className="mt-0.5 text-sm text-zinc-200">{children}</div>
      </div>
    </div>
  );
}

function TimelineItem({ label, date }: { label: string; date: string }) {
  return (
    <div className="relative flex items-start gap-3">
      <div className="absolute -left-6 top-1 size-3.5 rounded-full border-2 border-red-700 bg-zinc-900" />
      <div>
        <div className="text-sm text-zinc-300">{label}</div>
        <div className="mt-0.5 text-xs text-zinc-500">
          {formatAbsoluteDate(date)} &middot; {formatRelativeDate(date)}
        </div>
      </div>
    </div>
  );
}

// Kind-specific overview cards. Each leads with the data that matters most
// for triaging a finding of that kind — component/fix for SCA, file+snippet
// for SAST/IaC, request shape for DAST, redacted secret metadata for Secrets.
// The generic metadata grid (source, times_seen, timestamps) still renders
// below all of these so users can always fall back to it.

function SCAOverview({ finding }: { finding: Finding }) {
  return (
    <Card className="border-zinc-800 bg-zinc-900/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-zinc-400">Уязвимый компонент</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2 text-sm text-zinc-200">
          <Package className="size-4 shrink-0 text-zinc-500" />
          <span className="break-all font-mono">
            {finding.component || "—"}
            {finding.component_version && (
              <span className="ml-1 text-zinc-500">
                @{finding.component_version}
              </span>
            )}
          </span>
        </div>
        {finding.fixed_version && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-zinc-500">Исправлено в:</span>
            <span className="rounded bg-emerald-950/40 px-1.5 py-0.5 font-mono text-xs text-emerald-300">
              {finding.fixed_version}
            </span>
          </div>
        )}
        {finding.package_ecosystem && (
          <div className="text-xs text-zinc-500">
            Экосистема:{" "}
            <span className="text-zinc-300">{finding.package_ecosystem}</span>
          </div>
        )}
        {finding.purl && (
          <code className="block break-all rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-300">
            {finding.purl}
          </code>
        )}
      </CardContent>
    </Card>
  );
}

function SASTOverview({ finding }: { finding: Finding }) {
  return (
    <div className="space-y-4">
      <Card className="border-zinc-800 bg-zinc-900/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-zinc-400">Расположение и правило</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {finding.file_path && (
            <div className="flex items-start gap-2">
              <FileCode className="mt-0.5 size-4 shrink-0 text-zinc-500" />
              <code className="break-all rounded bg-zinc-800 px-1.5 py-0.5 text-xs text-zinc-200">
                {finding.file_path}
                {finding.line_start
                  ? `:${finding.line_start}${finding.line_end && finding.line_end !== finding.line_start
                    ? `-${finding.line_end}`
                    : ""
                  }`
                  : ""}
              </code>
            </div>
          )}
          {finding.rule_id && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-zinc-500">Правило:</span>
              <span className="rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-xs text-zinc-200">
                {finding.rule_id}
              </span>
              {finding.rule_name && (
                <span className="text-xs text-zinc-400">{finding.rule_name}</span>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {finding.code_snippet && (
        <Card className="border-zinc-800 bg-zinc-900/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-zinc-400">Фрагмент кода</CardTitle>
          </CardHeader>
          <CardContent>
            <CodeSnippet
              code={finding.code_snippet}
              filePath={finding.file_path}
              highlightLine={finding.line_start}
              startLine={finding.line_start ?? 1}
              maxHeight={360}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function DASTOverview({ finding }: { finding: Finding }) {
  return (
    <Card className="border-zinc-800 bg-zinc-900/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-zinc-400">HTTP-запрос</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-start gap-2">
          <Globe className="mt-0.5 size-4 shrink-0 text-zinc-500" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              {finding.http_method && (
                <span className="rounded border border-zinc-700 bg-zinc-900 px-1.5 py-0.5 font-mono text-[11px] uppercase text-zinc-300">
                  {finding.http_method}
                </span>
              )}
              <span className="min-w-0 break-all font-mono text-sm text-zinc-200">
                {finding.url || "—"}
              </span>
            </div>
            {finding.http_param && (
              <div className="mt-1 text-sm">
                <span className="text-zinc-500">Параметр: </span>
                <span className="font-mono text-xs text-zinc-200">
                  {finding.http_param}
                </span>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function IaCOverview({ finding }: { finding: Finding }) {
  return (
    <div className="space-y-4">
      <Card className="border-zinc-800 bg-zinc-900/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-zinc-400">Ресурс инфраструктуры</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-start gap-2">
            <Server className="mt-0.5 size-4 shrink-0 text-zinc-500" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                {finding.iac_provider && (
                  <span className="rounded border border-teal-700/50 bg-teal-950/40 px-1.5 py-0.5 text-[11px] text-teal-300">
                    {finding.iac_provider}
                  </span>
                )}
                <span className="min-w-0 break-all font-mono text-sm text-zinc-200">
                  {finding.iac_resource || "—"}
                </span>
              </div>
              {finding.file_path && (
                <code className="mt-2 inline-block break-all rounded bg-zinc-800 px-1.5 py-0.5 text-xs text-zinc-300">
                  {finding.file_path}
                  {finding.line_start ? `:${finding.line_start}` : ""}
                </code>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {finding.code_snippet && (
        <Card className="border-zinc-800 bg-zinc-900/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-zinc-400">Фрагмент конфигурации</CardTitle>
          </CardHeader>
          <CardContent>
            <CodeSnippet
              code={finding.code_snippet}
              filePath={finding.file_path}
              highlightLine={finding.line_start}
              startLine={finding.line_start ?? 1}
              maxHeight={360}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function SecretsOverview({ finding }: { finding: Finding }) {
  return (
    <Card className="border-zinc-800 bg-zinc-900/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-zinc-400">Обнаруженный секрет</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2 text-sm text-zinc-200">
          <KeyRound className="size-4 shrink-0 text-zinc-500" />
          {finding.secret_kind ? (
            <span className="rounded border border-amber-700/50 bg-amber-950/40 px-1.5 py-0.5 text-xs text-amber-300">
              {finding.secret_kind}
            </span>
          ) : (
            <span className="text-zinc-500">Тип не указан</span>
          )}
        </div>
        {finding.file_path && (
          <code className="block break-all rounded bg-zinc-800 px-1.5 py-0.5 text-xs text-zinc-300">
            {finding.file_path}
            {finding.line_start ? `:${finding.line_start}` : ""}
          </code>
        )}
        {finding.commit_sha && (
          <div className="flex items-center gap-1.5 text-xs text-zinc-500">
            <GitCommit className="size-3" />
            <span className="font-mono text-zinc-300">{finding.commit_sha}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function KindOverview({ finding }: { finding: Finding }) {
  switch (finding.kind) {
    case "sca":
      return <SCAOverview finding={finding} />;
    case "sast":
      return <SASTOverview finding={finding} />;
    case "dast":
      return <DASTOverview finding={finding} />;
    case "iac":
      return <IaCOverview finding={finding} />;
    case "secrets":
      return <SecretsOverview finding={finding} />;
    default:
      return null;
  }
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-full max-w-3xl bg-zinc-800/50" />
      <div className="flex gap-4">
        <Skeleton className="h-6 w-20 bg-zinc-800/50" />
        <Skeleton className="h-6 w-24 bg-zinc-800/50" />
      </div>
      <Skeleton className="h-64 w-full bg-zinc-800/50" />
    </div>
  );
}

export default function FindingDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const {
    data,
    isLoading,
    isError,
    error,
  } = useFinding(id ?? "");

  const { data: scoreData } = useFindingScore(id ?? "");
  const { data: currentUser } = useCurrentUser();
  const updateStatus = useUpdateStatus();
  const triageAction = useTriageAction();
  const createComment = useCreateComment(id ?? "");

  const finding = data?.data.finding;
  const score = scoreData?.data ?? data?.data.score;

  const cveIds = finding?.cve_ids ?? [];
  const cweIds = finding?.cwe_ids ?? [];
  const goBack = useCallback(() => {
    navigate("/findings");
  }, [navigate]);

  useHotkey("Escape", () => {
    goBack();
  });

  const handleStatusChange = useCallback(
    (status: number) => {
      if (!finding || updateStatus.isPending || finding.status === status) {
        return;
      }

      updateStatus.mutate({ id: finding.id, status });
    },
    [finding, updateStatus],
  );

  if (isLoading) {
    return (
      <div>
        <Button
          variant="ghost"
          size="sm"
          onClick={goBack}
          className="mb-4 text-zinc-400 hover:text-zinc-200"
        >
          <ArrowLeft className="size-4" />
          Назад к находкам
        </Button>
        <LoadingSkeleton />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="mx-auto max-w-5xl">
        <Button
          variant="ghost"
          size="sm"
          onClick={goBack}
          className="mb-4 text-zinc-400 hover:text-zinc-200"
        >
          <ArrowLeft className="size-4" />
          Назад к находкам
        </Button>

        <Card className="border-zinc-800 bg-zinc-900/50">
          <CardContent className="pt-6">
            <div className="space-y-2">
              <div className="text-base font-medium text-zinc-100">
                Failed to load finding
              </div>
              <div className="text-sm text-zinc-400">
                {error instanceof Error ? error.message : "Unknown error"}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!finding) {
    return (
      <div className="mx-auto max-w-5xl">
        <Button
          variant="ghost"
          size="sm"
          onClick={goBack}
          className="mb-4 text-zinc-400 hover:text-zinc-200"
        >
          <ArrowLeft className="size-4" />
          Назад к находкам
        </Button>

        <Card className="border-zinc-800 bg-zinc-900/50">
          <CardContent className="pt-6">
            <div className="space-y-2">
              <div className="text-base font-medium text-zinc-100">
                Finding not found
              </div>
              <div className="text-sm text-zinc-400">
                The requested finding does not exist or is no longer available.
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl">
      <Button
        variant="ghost"
        size="sm"
        onClick={goBack}
        className="mb-4 text-zinc-400 hover:text-zinc-200"
      >
        <ArrowLeft className="size-4" />
        Назад к находкам
      </Button>

      <div className="mb-6 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <SeverityBadge severity={finding.severity} />
          <h1 className="text-xl font-semibold text-zinc-100">
            {finding.title}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={updateStatus.isPending}
                  className="h-auto px-0 py-0 text-sm hover:bg-transparent"
                >
                  {updateStatus.isPending ? (
                    <Loader2 className="mr-1 size-3.5 animate-spin text-zinc-500" />
                  ) : null}
                  <StatusBadge status={finding.status} />
                  <ChevronDown className="size-3.5 text-zinc-500" />
                </Button>
              }
            />

            <DropdownMenuContent align="start" className="border-zinc-700 bg-zinc-900">
              {statusOptions.map((opt) => (
                <DropdownMenuItem
                  key={opt.value}
                  disabled={updateStatus.isPending || opt.value === finding.status}
                  onClick={() => handleStatusChange(opt.value)}
                  className="text-zinc-300 focus:bg-zinc-800 focus:text-zinc-100"
                >
                  {opt.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <span className="font-mono text-xs text-zinc-600">{finding.id}</span>
          <Button
            variant="outline"
            size="sm"
            disabled={!currentUser || triageAction.isPending}
            onClick={() => {
              if (!currentUser) return;
              triageAction.mutate({
                id: finding.id,
                request: {
                  action: "assign",
                  to_user_id: currentUser.id,
                  to_email: currentUser.email,
                },
              });
            }}
            className="border-zinc-700 bg-zinc-900 text-zinc-300"
          >
            Назначить мне
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={triageAction.isPending}
            onClick={() => triageAction.mutate({ id: finding.id, request: { action: "unassign" } })}
            className="text-zinc-400 hover:text-zinc-200"
          >
            Снять назначение
          </Button>
        </div>

        {(finding.priority_score != null || score) && (
          <div className="w-full max-w-72">
            <PriorityScore
              score={finding.priority_score ?? score?.priority_score ?? 0}
              breakdown={score}
              size="lg"
            />
          </div>
        )}
      </div>

      <Tabs defaultValue="overview">
        <TabsList variant="line" className="mb-4">
          <TabsTrigger value="overview">Обзор</TabsTrigger>
          <TabsTrigger value="identifiers">Идентификаторы</TabsTrigger>
          <TabsTrigger value="enrichment">Обогащение</TabsTrigger>
          <TabsTrigger value="comments">Комментарии</TabsTrigger>
          <TabsTrigger value="history">История</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="space-y-4">
            {finding.description && (
              <Card className="border-zinc-800 bg-zinc-900/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-zinc-400">
                    Описание
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-300">
                    {finding.description}
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Kind-specific overview card leads with what matters most for
              this kind (component/fix, file+snippet, URL, resource, etc.).
              Returns null for the "other" kind so the generic grid below
              still carries the load. */}
            <KindOverview finding={finding} />

            <Card className="border-zinc-800 bg-zinc-900/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-zinc-400">Метаданные</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 pt-2 sm:grid-cols-2">
                <DetailRow icon={Scan} label="Источник">
                  {finding.source_type}
                </DetailRow>

                <DetailRow icon={Eye} label="Количество обнаружений">
                  {finding.times_seen}
                </DetailRow>

                <DetailRow icon={Clock} label="Первое обнаружение">
                  {formatAbsoluteDate(finding.first_seen)}
                  <span className="ml-1 text-zinc-500">
                    ({formatRelativeDate(finding.first_seen)})
                  </span>
                </DetailRow>

                <DetailRow icon={Clock} label="Последнее обнаружение">
                  {formatAbsoluteDate(finding.last_seen)}
                  <span className="ml-1 text-zinc-500">
                    ({formatRelativeDate(finding.last_seen)})
                  </span>
                </DetailRow>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="identifiers">
          <div className="space-y-4">
            <Card className="border-zinc-800 bg-zinc-900/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-zinc-400">CVE IDs</CardTitle>
              </CardHeader>
              <CardContent>
                {cveIds.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {cveIds.map((cve) => (
                      <a
                        key={cve}
                        href={`https://nvd.nist.gov/vuln/detail/${cve}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-md bg-zinc-800 px-2 py-1 font-mono text-xs text-red-400 transition-colors hover:bg-zinc-700 hover:text-red-300"
                      >
                        {cve}
                        <ExternalLink className="size-3" />
                      </a>
                    ))}
                  </div>
                ) : (
                  <span className="text-sm text-zinc-600">Нет CVE</span>
                )}
              </CardContent>
            </Card>

            <Card className="border-zinc-800 bg-zinc-900/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-zinc-400">CWE IDs</CardTitle>
              </CardHeader>
              <CardContent>
                {cweIds.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {cweIds.map((rawCwe) => {
                      const cwe = normalizeCweId(rawCwe);

                      return (
                        <a
                          key={String(rawCwe)}
                          href={`https://cwe.mitre.org/data/definitions/${cwe}.html`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-md bg-zinc-800 px-2 py-1 font-mono text-xs text-blue-400 transition-colors hover:bg-zinc-700 hover:text-blue-300"
                        >
                          CWE-{cwe}
                          <ExternalLink className="size-3" />
                        </a>
                      );
                    })}
                  </div>
                ) : (
                  <span className="text-sm text-zinc-600">Нет CWE</span>
                )}
              </CardContent>
            </Card>

            {finding.cpe_uri && (
              <Card className="border-zinc-800 bg-zinc-900/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-zinc-400">CPE URI</CardTitle>
                </CardHeader>
                <CardContent>
                  <code className="block break-all rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-300">
                    {finding.cpe_uri}
                  </code>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="enrichment">
          <EnrichmentTabs findingId={finding.id} />
        </TabsContent>

        <TabsContent value="comments">
          <div className="space-y-4">
            <CommentForm
              submitting={createComment.isPending}
              onSubmit={async (text) => {
                await createComment.mutateAsync(text);
              }}
            />
            <CommentList findingId={finding.id} />
          </div>
        </TabsContent>

        <TabsContent value="history">
          <FindingHistory findingId={finding.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
