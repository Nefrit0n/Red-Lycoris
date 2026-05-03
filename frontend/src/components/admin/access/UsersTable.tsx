import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
  type RowSelectionState,
} from "@tanstack/react-table";
import { Skeleton } from "@/components/ui/skeleton";
import { AvatarInitials } from "./AvatarInitials";
import { RoleBadge } from "./RoleBadge";
import { UserStatusBadge } from "./UserStatusBadge";
import { MfaCell } from "./MfaCell";
import { SourceBadge } from "./SourceBadge";
import { GroupsCell } from "./GroupsCell";
import { LastLoginCell } from "./LastLoginCell";
import { UserKebabMenu } from "./UserKebabMenu";
import { Badge } from "@/components/ui/badge";
import type { AdminUser } from "@/api/admin-users";
import type { CurrentUser } from "@/api/auth";
import { cn } from "@/lib/utils";

interface Props {
  users: AdminUser[];
  isLoading: boolean;
  currentUser: CurrentUser | null | undefined;
  activeAdminCount: number;
  rowSelection: RowSelectionState;
  onRowSelectionChange: (sel: RowSelectionState) => void;
}

function EmailCell({ user, currentUser }: { user: AdminUser; currentUser?: CurrentUser | null }) {
  const isSelf = currentUser?.id === user.id;
  return (
    <div className="flex items-center gap-2 min-w-0">
      <AvatarInitials
        id={user.id}
        email={user.email}
        displayName={user.display_name || undefined}
        size={24}
      />
      <span className="truncate text-sm">{user.email}</span>
      <div className="flex items-center gap-1 shrink-0">
        {isSelf && (
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
            вы
          </Badge>
        )}
        {user.is_system_account && (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 text-muted-foreground">
            system
          </Badge>
        )}
        {user.must_change_password && (
          <Badge
            variant="outline"
            className="text-[10px] px-1.5 py-0 h-4"
            style={{
              backgroundColor: "var(--status-pending-bg)",
              color: "var(--status-pending-fg)",
              borderColor: "var(--status-pending-dot)",
            }}
          >
            ⚠ смена пароля
          </Badge>
        )}
      </div>
    </div>
  );
}

export function UsersTable({
  users,
  isLoading,
  currentUser,
  activeAdminCount,
  rowSelection,
  onRowSelectionChange,
}: Props) {
  const navigate = useNavigate();

  const columns = useMemo<ColumnDef<AdminUser>[]>(
    () => [
      {
        id: "select",
        size: 40,
        header: ({ table }) => (
          <input
            type="checkbox"
            className="rounded cursor-pointer"
            checked={table.getIsAllRowsSelected()}
            ref={(el) => {
              if (el) el.indeterminate = table.getIsSomeRowsSelected();
            }}
            onChange={table.getToggleAllRowsSelectedHandler()}
            onClick={(e) => e.stopPropagation()}
          />
        ),
        cell: ({ row }) => (
          <input
            type="checkbox"
            className="rounded cursor-pointer"
            checked={row.getIsSelected()}
            onChange={row.getToggleSelectedHandler()}
            onClick={(e) => e.stopPropagation()}
          />
        ),
      },
      {
        id: "email",
        accessorKey: "email",
        header: "Email",
        size: 260,
        cell: ({ row }) => (
          <EmailCell user={row.original} currentUser={currentUser} />
        ),
      },
      {
        id: "display_name",
        accessorKey: "display_name",
        header: "ФИО",
        size: 150,
        cell: ({ row }) =>
          row.original.display_name ? (
            <span className="text-sm">{row.original.display_name}</span>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          ),
      },
      {
        id: "role",
        accessorKey: "role",
        header: "Роль",
        size: 100,
        cell: ({ row }) => <RoleBadge role={row.original.role} />,
      },
      {
        id: "groups",
        accessorKey: "groups",
        header: "Группы",
        size: 200,
        cell: ({ row }) => <GroupsCell groups={row.original.groups} />,
      },
      {
        id: "status",
        accessorKey: "status",
        header: "Статус",
        size: 120,
        cell: ({ row }) => <UserStatusBadge status={row.original.status} />,
      },
      {
        id: "mfa",
        accessorKey: "mfa_enabled",
        header: "MFA",
        size: 48,
        cell: ({ row }) => (
          <MfaCell
            mfaEnabled={row.original.mfa_enabled}
            isSystemAccount={row.original.is_system_account}
          />
        ),
      },
      {
        id: "source",
        accessorKey: "identity_kind",
        header: "Источник",
        size: 80,
        cell: ({ row }) => <SourceBadge kind={row.original.identity_kind} />,
      },
      {
        id: "last_login",
        accessorKey: "last_login_at",
        header: "Последний вход",
        size: 140,
        cell: ({ row }) => <LastLoginCell user={row.original} />,
      },
      {
        id: "actions",
        size: 40,
        header: "",
        cell: ({ row }) => (
          <UserKebabMenu
            user={row.original}
            currentUser={currentUser}
            activeAdminCount={activeAdminCount}
          />
        ),
      },
    ],
    [currentUser, activeAdminCount]
  );

  const table = useReactTable({
    data: users,
    columns,
    state: { rowSelection },
    enableRowSelection: true,
    onRowSelectionChange: (updater) => {
      const next =
        typeof updater === "function" ? updater(rowSelection) : updater;
      onRowSelectionChange(next);
    },
    getRowId: (row) => row.id,
    getCoreRowModel: getCoreRowModel(),
  });

  if (isLoading) {
    return (
      <div className="rounded-lg border border-border overflow-hidden">
        <div className="bg-secondary/50 px-3 py-2 flex gap-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-3 w-16" />
          ))}
        </div>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="border-t border-border/50 px-3 py-3 flex gap-6">
            {Array.from({ length: 8 }).map((__, j) => (
              <Skeleton key={j} className="h-4 w-20" />
            ))}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <table className="w-full text-sm border-collapse">
        <thead>
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id} className="bg-secondary/50">
              {hg.headers.map((header) => (
                <th
                  key={header.id}
                  className="px-3 py-2 text-left text-[10px] font-medium uppercase tracking-wide text-muted-foreground whitespace-nowrap"
                  style={{ width: header.getSize() }}
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr
              key={row.id}
              className={cn(
                "border-t border-border/50 cursor-pointer transition-colors hover:bg-secondary/30",
                row.getIsSelected() && "bg-accent/40"
              )}
              onClick={() => navigate(`/admin/access/users/${row.original.id}`)}
            >
              {row.getVisibleCells().map((cell) => (
                <td
                  key={cell.id}
                  className="px-3 py-2.5"
                  style={{ width: cell.column.getSize() }}
                >
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
          {table.getRowModel().rows.length === 0 && (
            <tr>
              <td
                colSpan={columns.length}
                className="py-16 text-center text-sm text-muted-foreground"
              >
                Ничего не найдено
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
