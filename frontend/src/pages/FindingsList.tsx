import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw, ChevronDown, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import FindingsTable from "@/components/FindingsTable";
import FacetedFilters from "@/components/FacetedFilters";
import { useFindings, useBulkUpdateStatus } from "@/api/findings";
import { useFiltersStore } from "@/store/filters";
import type { Finding } from "@/types";

const statusOptions = [
  { value: 0, label: "Open" },
  { value: 1, label: "Confirmed" },
  { value: 2, label: "False Positive" },
  { value: 3, label: "Resolved" },
  { value: 4, label: "Risk Accepted" },
];

function isFinding(value: unknown): value is Finding {
  if (!value || typeof value !== "object") return false;

  const candidate = value as Partial<Finding>;
  return typeof candidate.id === "string" && candidate.id.length > 0;
}

export default function FindingsList() {
  const filters = useFiltersStore();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const {
    data,
    isLoading,
    isError,
    error,
    isFetching,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    refetch,
  } = useFindings({
    severities: filters.severities,
    statuses: filters.statuses,
    query: filters.query,
    projectId: filters.projectId,
    sortField: filters.sortField,
    sortDir: filters.sortDir,
  });

  const bulkUpdate = useBulkUpdateStatus();

  const findings = useMemo<Finding[]>(() => {
    if (!data?.pages) return [];

    return data.pages.flatMap((page) => {
      if (!Array.isArray(page?.data)) return [];
      return page.data.filter(isFinding);
    });
  }, [data]);

  const total = data?.pages?.[0]?.meta?.total ?? findings.length;

  useEffect(() => {
    const visibleIds = new Set(findings.map((finding) => finding.id));

    setSelectedIds((prev) => {
      const next = new Set([...prev].filter((id) => visibleIds.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [findings]);

  const allSelected = useMemo(() => {
    if (findings.length === 0) return false;
    return findings.every((finding) => selectedIds.has(finding.id));
  }, [findings, selectedIds]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    setSelectedIds((prev) => {
      if (findings.length === 0) return new Set();

      const everySelected = findings.every((finding) => prev.has(finding.id));
      if (everySelected) return new Set();

      return new Set(findings.map((finding) => finding.id));
    });
  }, [findings]);

  const handleBulkStatus = useCallback(
    (status: number) => {
      if (selectedIds.size === 0 || bulkUpdate.isPending) return;

      bulkUpdate.mutate(
        { ids: Array.from(selectedIds), status },
        {
          onSuccess: async () => {
            setSelectedIds(new Set());
            await refetch();
          },
        },
      );
    },
    [selectedIds, bulkUpdate, refetch],
  );

  if (isError) {
    return (
      <div className="flex h-full gap-6">
        <FacetedFilters />
        <div className="flex min-w-0 flex-1 flex-col gap-4 p-6">
          <div className="rounded-xl border border-red-900/50 bg-red-950/20 p-4">
            <div className="text-sm font-medium text-red-300">
              Failed to load findings
            </div>
            <div className="mt-1 text-sm text-red-200/70">
              {error instanceof Error ? error.message : "Unknown error"}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full gap-6">
      <FacetedFilters />

      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="text-sm text-zinc-400">
              <span className="font-medium text-zinc-200">
                {total.toLocaleString()}
              </span>{" "}
              findings
            </span>

            {selectedIds.size > 0 && (
              <span className="text-sm text-violet-400">
                {selectedIds.size} selected
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {selectedIds.size > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={bulkUpdate.isPending}
                    className="border-zinc-700 bg-zinc-900 text-zinc-300"
                  >
                    {bulkUpdate.isPending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : null}
                    Set status
                    <ChevronDown className="size-3.5" />
                  </Button>
                </DropdownMenuTrigger>

                <DropdownMenuContent
                  align="end"
                  className="border-zinc-700 bg-zinc-900"
                >
                  {statusOptions.map((opt) => (
                    <DropdownMenuItem
                      key={opt.value}
                      disabled={bulkUpdate.isPending}
                      onClick={() => handleBulkStatus(opt.value)}
                      className="text-zinc-300 focus:bg-zinc-800 focus:text-zinc-100"
                    >
                      {opt.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => void refetch()}
              disabled={isFetching || bulkUpdate.isPending}
              className="text-zinc-400 hover:text-zinc-200"
            >
              <RefreshCw
                className={`size-4 ${isFetching && !isFetchingNextPage ? "animate-spin" : ""
                  }`}
              />
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 text-sm text-zinc-400">
            Loading findings...
          </div>
        ) : findings.length === 0 ? (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-8">
            <div className="text-base font-medium text-zinc-200">
              No findings yet
            </div>
            <div className="mt-1 text-sm text-zinc-500">
              Upload a scan result or change filters to see findings here.
            </div>
          </div>
        ) : (
          <FindingsTable
            findings={findings}
            isLoading={false}
            selectedIds={selectedIds}
            onToggleSelect={toggleSelect}
            onToggleAll={toggleAll}
            allSelected={allSelected}
          />
        )}

        {hasNextPage && findings.length > 0 && (
          <div className="flex justify-center pb-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void fetchNextPage()}
              disabled={isFetchingNextPage}
              className="border-zinc-700 bg-zinc-900 text-zinc-300"
            >
              {isFetchingNextPage ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Loading...
                </>
              ) : (
                "Load more"
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}