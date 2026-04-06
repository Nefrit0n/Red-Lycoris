import { useCallback, useMemo, useState } from "react";
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

export default function FindingsList() {
  const filters = useFiltersStore();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const { data, isLoading, isFetchingNextPage, hasNextPage, fetchNextPage, refetch } =
    useFindings({
      severities: filters.severities,
      statuses: filters.statuses,
      query: filters.query,
      projectId: filters.projectId,
      sortField: filters.sortField,
      sortDir: filters.sortDir,
    });

  const findings: Finding[] = useMemo(
    () => data?.pages.flatMap((p) => p.data) ?? [],
    [data],
  );

  const total = data?.pages[0]?.meta.total ?? 0;

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
      if (prev.size === findings.length) return new Set();
      return new Set(findings.map((f) => f.id));
    });
  }, [findings]);

  const bulkUpdate = useBulkUpdateStatus();

  const handleBulkStatus = useCallback(
    (status: number) => {
      if (selectedIds.size === 0) return;
      bulkUpdate.mutate(
        { ids: Array.from(selectedIds), status },
        { onSuccess: () => setSelectedIds(new Set()) },
      );
    },
    [selectedIds, bulkUpdate],
  );

  return (
    <div className="flex h-full gap-6">
      <FacetedFilters />

      <div className="flex min-w-0 flex-1 flex-col gap-4">
        {/* Toolbar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
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
                <DropdownMenuTrigger
                  render={
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-zinc-700 bg-zinc-900 text-zinc-300"
                    />
                  }
                >
                  Set status
                  <ChevronDown className="size-3.5" />
                </DropdownMenuTrigger>
                <DropdownMenuContent className="border-zinc-700 bg-zinc-900">
                  {statusOptions.map((opt) => (
                    <DropdownMenuItem
                      key={opt.value}
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
              onClick={() => refetch()}
              className="text-zinc-400 hover:text-zinc-200"
            >
              <RefreshCw className="size-4" />
            </Button>
          </div>
        </div>

        {/* Table */}
        <FindingsTable
          findings={findings}
          isLoading={isLoading}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
          onToggleAll={toggleAll}
          allSelected={selectedIds.size === findings.length && findings.length > 0}
        />

        {/* Load more */}
        {hasNextPage && (
          <div className="flex justify-center pb-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
              className="border-zinc-700 bg-zinc-900 text-zinc-300"
            >
              {isFetchingNextPage ? (
                <Loader2 className="size-4 animate-spin" />
              ) : null}
              Load more
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
