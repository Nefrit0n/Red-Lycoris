import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/api/client";

export interface VersionInfo {
  version: string;
  commit: string;
  build_date: string;
  go_version: string;
}

export function useVersion() {
  return useQuery<VersionInfo>({
    queryKey: ["version"],
    queryFn: () => apiGet<VersionInfo>("/api/v1/version"),
    staleTime: 24 * 60 * 60 * 1000,
    retry: false,
  });
}
