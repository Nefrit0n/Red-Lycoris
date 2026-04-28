import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import type { UserListParams } from "@/api/admin-users";

export interface UsersFilters {
  q: string;
  roles: string[];
  statuses: string[];
  groupId: string;
  mfa: "" | "enabled" | "disabled";
  source: string;
  dormant: boolean;
  sort: string;
  cursor: string;
}

const DEFAULT_SORT = "last_login_desc";

function parseFilters(params: URLSearchParams): UsersFilters {
  return {
    q: params.get("q") ?? "",
    roles: params.get("role") ? params.get("role")!.split(",").filter(Boolean) : [],
    statuses: params.get("status") ? params.get("status")!.split(",").filter(Boolean) : [],
    groupId: params.get("group") ?? "",
    mfa: (params.get("mfa") as UsersFilters["mfa"]) ?? "",
    source: params.get("source") ?? "",
    dormant: params.get("dormant") === "true",
    sort: params.get("sort") ?? DEFAULT_SORT,
    cursor: params.get("cursor") ?? "",
  };
}

export function filtersToApiParams(f: UsersFilters): UserListParams {
  const p: UserListParams = {};
  if (f.q) p.q = f.q;
  if (f.roles.length) p.role = f.roles.join(",");
  if (f.statuses.length) p.status = f.statuses.join(",");
  if (f.groupId) p.group = f.groupId;
  if (f.mfa) p.mfa = f.mfa;
  if (f.source) p.source = f.source;
  if (f.dormant) p.dormant = true;
  if (f.sort && f.sort !== DEFAULT_SORT) p.sort = f.sort;
  if (f.cursor) p.cursor = f.cursor;
  return p;
}

export function useUsersFilters() {
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = parseFilters(searchParams);

  const setFilter = useCallback(
    (key: keyof UsersFilters, value: unknown) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.delete("cursor"); // reset cursor on filter change
          if (key === "roles" || key === "statuses") {
            const arr = value as string[];
            if (arr.length === 0) {
              next.delete(key === "roles" ? "role" : "status");
            } else {
              next.set(key === "roles" ? "role" : "status", arr.join(","));
            }
          } else if (key === "dormant") {
            if (value) next.set("dormant", "true");
            else next.delete("dormant");
          } else if (key === "sort") {
            if (value === DEFAULT_SORT) next.delete("sort");
            else next.set("sort", value as string);
          } else if (key === "cursor") {
            if (value) next.set("cursor", value as string);
            else next.delete("cursor");
          } else if (key === "q") {
            if (value) next.set("q", value as string);
            else next.delete("q");
          } else if (key === "groupId") {
            if (value) next.set("group", value as string);
            else next.delete("group");
          } else if (key === "mfa") {
            if (value) next.set("mfa", value as string);
            else next.delete("mfa");
          } else if (key === "source") {
            if (value) next.set("source", value as string);
            else next.delete("source");
          }
          return next;
        },
        { replace: false }
      );
    },
    [setSearchParams]
  );

  const removeFilter = useCallback(
    (key: keyof UsersFilters) => {
      setFilter(key, key === "roles" || key === "statuses" ? [] : "");
    },
    [setFilter]
  );

  const resetFilters = useCallback(() => {
    setSearchParams({}, { replace: false });
  }, [setSearchParams]);

  const activeFilterCount =
    (filters.q ? 1 : 0) +
    filters.roles.length +
    filters.statuses.length +
    (filters.groupId ? 1 : 0) +
    (filters.mfa ? 1 : 0) +
    (filters.source ? 1 : 0) +
    (filters.dormant ? 1 : 0);

  return {
    filters,
    setFilter,
    removeFilter,
    resetFilters,
    activeFilterCount,
  };
}

export type { UserListParams };
