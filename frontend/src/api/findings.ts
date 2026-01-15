import { ApiResponse, FetchFindingsParams } from "../types/findings";

export const fetchFindings = async (
  params: FetchFindingsParams,
  signal?: AbortSignal
): Promise<ApiResponse> => {
  const searchParams = new URLSearchParams();
  searchParams.set("page", params.page.toString());
  searchParams.set("pageSize", params.pageSize.toString());

  if (params.filterApp) {
    searchParams.set("filter_app", params.filterApp);
  }
  if (params.filterSeverity) {
    searchParams.set("filter_severity", params.filterSeverity);
  }
  if (params.filterStatus) {
    searchParams.set("filter_status", params.filterStatus);
  }
  if (params.sortField) {
    searchParams.set("sortField", params.sortField);
  }
  if (params.sortOrder) {
    searchParams.set("sortOrder", params.sortOrder);
  }

  const response = await fetch(`/api/v1/findings?${searchParams.toString()}`, {
    method: "GET",
    signal,
  });

  if (!response.ok) {
    throw new Error("Не удалось загрузить список находок");
  }

  return response.json();
};
