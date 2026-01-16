import {
  ApiResponse,
  FetchFindingsParams,
  FindingDetail,
  FindingDetailStatus,
} from "../types/findings";

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

export const fetchFindingDetail = async (
  id: string,
  signal?: AbortSignal
): Promise<FindingDetail> => {
  const response = await fetch(`/api/v1/findings/${id}`, {
    method: "GET",
    signal,
  });

  if (!response.ok) {
    throw new Error("Не удалось загрузить детали уязвимости");
  }

  return response.json();
};

export const updateFindingStatus = async (
  id: string,
  status: FindingDetailStatus
): Promise<void> => {
  const response = await fetch(`/api/v1/findings/${id}/status`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ status }),
  });

  if (!response.ok) {
    throw new Error("Не удалось обновить статус");
  }
};

export const assignResponsible = async (
  id: string,
  userId: string
): Promise<void> => {
  const response = await fetch(`/api/v1/findings/${id}/assign`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ userId }),
  });

  if (!response.ok) {
    throw new Error("Не удалось назначить ответственного");
  }
};
