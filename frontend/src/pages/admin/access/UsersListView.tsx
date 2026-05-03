import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useCurrentUser } from "@/api/auth";
import { fetchAdminUsers } from "@/api/admin-users";
import { useUsersFilters, filtersToApiParams } from "@/hooks/admin/useUsersFilters";
import { UsersToolbar } from "@/components/admin/access/UsersToolbar";
import { UsersTable } from "@/components/admin/access/UsersTable";
import { UsersBulkBar } from "@/components/admin/access/UsersBulkBar";
import { CreateUserModal } from "@/components/admin/access/CreateUserModal";
import { Button } from "@/components/ui/button";
import type { RowSelectionState } from "@tanstack/react-table";

export default function UsersListView() {
  const { data: currentUser } = useCurrentUser();
  const { filters, setFilter, removeFilter, resetFilters } = useUsersFilters();

  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [createOpen, setCreateOpen] = useState(false);

  const apiParams = useMemo(() => filtersToApiParams(filters), [filters]);

  const usersQuery = useQuery({
    queryKey: ["admin-users", apiParams],
    queryFn: () => fetchAdminUsers(apiParams),
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });

  const users = usersQuery.data?.data ?? [];
  const meta = usersQuery.data?.meta;

  const activeAdminCount = useMemo(
    () => users.filter((u) => u.role.key === "admin" && u.status === "active").length,
    [users]
  );

  const selectedIds = Object.keys(rowSelection).filter((id) => rowSelection[id]);

  return (
    <div className="flex flex-col gap-4 min-h-0">
      <UsersToolbar
        filters={filters}
        setFilter={setFilter}
        removeFilter={removeFilter}
        onCreateUser={() => setCreateOpen(true)}
      />

      {/* Results summary */}
      {meta && (
        <div className="text-xs text-muted-foreground">
          {meta.total === 0
            ? "Нет пользователей"
            : `${meta.total} пользователей`}
        </div>
      )}

      {/* Empty state — no users at all */}
      {!usersQuery.isLoading && users.length === 0 && !filters.q &&
        filters.roles.length === 0 && filters.statuses.length === 0 &&
        !filters.groupId && !filters.mfa && !filters.source && !filters.dormant && (
        <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
          <div className="text-4xl">👤</div>
          <div>
            <p className="text-base font-medium">Пользователей ещё нет</p>
            <p className="text-sm text-muted-foreground mt-1">
              Создайте первого пользователя, чтобы начать
            </p>
          </div>
          <Button onClick={() => setCreateOpen(true)}>
            + Создать первого пользователя
          </Button>
        </div>
      )}

      {/* Empty state — filter returned nothing */}
      {!usersQuery.isLoading && users.length === 0 &&
        (filters.q || filters.roles.length > 0 || filters.statuses.length > 0 ||
          filters.groupId || filters.mfa || filters.source || filters.dormant) && (
        <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
          <div className="text-3xl">🔍</div>
          <div>
            <p className="text-base font-medium">Ничего не найдено</p>
            <p className="text-sm text-muted-foreground mt-1">
              Попробуйте изменить параметры поиска или фильтры
            </p>
          </div>
          <Button variant="outline" onClick={resetFilters}>
            Сбросить фильтры
          </Button>
        </div>
      )}

      {/* Table */}
      {(usersQuery.isLoading || users.length > 0) && (
        <UsersTable
          users={users}
          isLoading={usersQuery.isLoading}
          currentUser={currentUser}
          activeAdminCount={activeAdminCount}
          rowSelection={rowSelection}
          onRowSelectionChange={setRowSelection}
        />
      )}

      {/* Pagination */}
      {meta?.has_more && (
        <div className="flex justify-center pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setFilter("cursor", meta.next_cursor)}
            disabled={usersQuery.isFetching}
          >
            {usersQuery.isFetching ? "Загрузка…" : "Следующая страница →"}
          </Button>
        </div>
      )}

      {/* Bulk actions */}
      <UsersBulkBar
        selectedIds={selectedIds}
        onClearSelection={() => setRowSelection({})}
        currentParams={apiParams}
      />

      <CreateUserModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}
