import { useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Clock,
  Eye,
  FileCode,
  Package,
  Scan,
  ExternalLink,
  ChevronDown,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
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
import { useFinding, useUpdateStatus } from "@/api/findings";
import { useFindingScore } from "@/api/enrichment";

const statusOptions = [
  { value: 0, label: "Открыта" },
  { value: 1, label: "Подтверждена" },
  { value: 2, label: "Ложное срабатывание" },
  { value: 3, label: "Устранена" },
  { value: 4, label: "Риск принят" },
];

function DetailRow({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="mt-0.5 size-4 shrink-0 text-zinc-500" />
      <div>
        <div className="text-xs text-zinc-500">{label}</div>
        <div className="mt-0.5 text-sm text-zinc-200">{children}</div>
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-96 bg-zinc-800/50" />
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
  const { data, isLoading } = useFinding(id ?? "");
  const { data: scoreData } = useFindingScore(id ?? "");
  const updateStatus = useUpdateStatus();

  const finding = data?.data;
  const score = scoreData?.data;

  const goBack = useCallback(() => navigate("/findings"), [navigate]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") goBack();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [goBack]);

  if (isLoading || !finding) {
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

  const handleStatusChange = (status: number) => {
    updateStatus.mutate({ id: finding.id, status });
  };

  return (
    <div className="mx-auto max-w-5xl">
      {/* Back button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={goBack}
        className="mb-4 text-zinc-400 hover:text-zinc-200"
      >
        <ArrowLeft className="size-4" />
        Назад к находкам
      </Button>

      {/* Header */}
      <div className="mb-6 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <SeverityBadge severity={finding.severity} />
          <h1 className="text-xl font-semibold text-zinc-100">
            {finding.title}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          {/* Status dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border-none bg-transparent p-0 text-sm">
                  <StatusBadge status={finding.status} />
                  <ChevronDown className="size-3.5 text-zinc-500" />
                </button>
              }
            />
            <DropdownMenuContent className="border-zinc-700 bg-zinc-900">
              {statusOptions.map((opt) => (
                <DropdownMenuItem
                  key={opt.value}
                  onClick={() => handleStatusChange(opt.value)}
                  className="text-zinc-300 focus:bg-zinc-800 focus:text-zinc-100"
                >
                  {opt.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <span className="font-mono text-xs text-zinc-600">{finding.id}</span>
        </div>

        {/* Priority score */}
        {(finding.priority_score != null || score) && (
          <div className="w-72">
            <PriorityScore
              score={finding.priority_score ?? score?.priority_score ?? 0}
              breakdown={score}
              size="lg"
            />
          </div>
        )}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList variant="line" className="mb-4">
          <TabsTrigger value="overview">Обзор</TabsTrigger>
          <TabsTrigger value="identifiers">Идентификаторы</TabsTrigger>
          <TabsTrigger value="enrichment">Обогащение</TabsTrigger>
          <TabsTrigger value="history">История</TabsTrigger>
        </TabsList>

        {/* Обзор */}
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

            <Card className="border-zinc-800 bg-zinc-900/50">
              <CardContent className="grid gap-4 pt-6 sm:grid-cols-2">
                {finding.file_path && (
                  <DetailRow icon={FileCode} label="Расположение">
                    <code className="rounded bg-zinc-800 px-1.5 py-0.5 text-xs">
                      {finding.file_path}
                      {finding.line_start
                        ? `:${finding.line_start}${finding.line_end && finding.line_end !== finding.line_start ? `-${finding.line_end}` : ""}`
                        : ""}
                    </code>
                  </DetailRow>
                )}

                {finding.component && (
                  <DetailRow icon={Package} label="Компонент">
                    {finding.component}
                    {finding.component_version && (
                      <span className="ml-1 text-zinc-500">
                        v{finding.component_version}
                      </span>
                    )}
                  </DetailRow>
                )}

                <DetailRow icon={Scan} label="Источник">
                  {finding.source_type}
                </DetailRow>

                <DetailRow icon={Eye} label="Количество обнаружений">
                  {finding.times_seen}
                </DetailRow>

                <DetailRow icon={Clock} label="Первое обнаружение">
                  {format(new Date(finding.first_seen), "PPp")}
                  <span className="ml-1 text-zinc-500">
                    (
                    {formatDistanceToNow(new Date(finding.first_seen), {
                      addSuffix: true,
                      locale: ru,
                    })}
                    )
                  </span>
                </DetailRow>

                <DetailRow icon={Clock} label="Последнее обнаружение">
                  {format(new Date(finding.last_seen), "PPp")}
                  <span className="ml-1 text-zinc-500">
                    (
                    {formatDistanceToNow(new Date(finding.last_seen), {
                      addSuffix: true,
                      locale: ru,
                    })}
                    )
                  </span>
                </DetailRow>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Идентификаторы */}
        <TabsContent value="identifiers">
          <div className="space-y-4">
            <Card className="border-zinc-800 bg-zinc-900/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-zinc-400">CVE IDs</CardTitle>
              </CardHeader>
              <CardContent>
                {finding.cve_ids.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {finding.cve_ids.map((cve) => (
                      <a
                        key={cve}
                        href={`https://nvd.nist.gov/vuln/detail/${cve}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-md bg-zinc-800 px-2 py-1 font-mono text-xs text-red-500 transition-colors hover:bg-zinc-700 hover:text-red-400"
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
                {finding.cwe_ids.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {finding.cwe_ids.map((cwe) => (
                      <a
                        key={cwe}
                        href={`https://cwe.mitre.org/data/definitions/${cwe}.html`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-md bg-zinc-800 px-2 py-1 font-mono text-xs text-blue-400 transition-colors hover:bg-zinc-700 hover:text-blue-300"
                      >
                        CWE-{cwe}
                        <ExternalLink className="size-3" />
                      </a>
                    ))}
                  </div>
                ) : (
                  <span className="text-sm text-zinc-600">Нет CWE</span>
                )}
              </CardContent>
            </Card>

            {finding.cpe_uri && (
              <Card className="border-zinc-800 bg-zinc-900/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-zinc-400">
                    CPE URI
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <code className="rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-300">
                    {finding.cpe_uri}
                  </code>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* Обогащение */}
        <TabsContent value="enrichment">
          <EnrichmentTabs findingId={finding.id} />
        </TabsContent>

        {/* История */}
        <TabsContent value="history">
          <Card className="border-zinc-800 bg-zinc-900/50">
            <CardContent className="pt-6">
              <div className="relative space-y-6 pl-6 before:absolute before:left-[7px] before:top-2 before:h-[calc(100%-16px)] before:w-px before:bg-zinc-800">
                <TimelineItem
                  label="Впервые обнаружено"
                  date={finding.first_seen}
                />
                {finding.times_seen > 1 && (
                  <div className="relative flex items-start gap-3">
                    <div className="absolute -left-6 top-1 size-3.5 rounded-full border-2 border-zinc-700 bg-zinc-900" />
                    <div>
                      <div className="text-sm text-zinc-300">
                        Обнаружено {finding.times_seen} раз
                      </div>
                    </div>
                  </div>
                )}
                <TimelineItem
                  label="Последнее обнаружение"
                  date={finding.last_seen}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
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
          {format(new Date(date), "PPp")} &middot;{" "}
          {formatDistanceToNow(new Date(date), { addSuffix: true, locale: ru })}
        </div>
      </div>
    </div>
  );
}
