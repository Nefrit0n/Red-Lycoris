import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Finding,
  FindingOccurrenceStatus,
  FindingSeverity,
  FindingStatus,
} from '../types/findings';
import { getUrlParam, getUrlParamNumber, buildQueryString } from '../utils/urlHelpers';

const severityOptions: FindingSeverity[] = ['low', 'medium', 'high', 'critical'];
const statusOptions: FindingStatus[] = [
  'new',
  'under_review',
  'confirmed',
  'false_positive',
  'out_of_scope',
  'risk_accepted',
  'mitigated',
  'duplicate',
];
const occurrenceOptions: FindingOccurrenceStatus[] = ['NEW', 'REPEAT'];

export interface FiltersState {
  // Pagination
  page: number;
  pageSize: number;

  // Filters
  productId: string;
  searchInput: string;
  importJobId: string;
  filterSeverity: FindingSeverity | '';
  filterStatus: FindingStatus | '';
  filterOccurrence: FindingOccurrenceStatus | '';
  filterScannerType: string;
  dateFrom: string;
  dateTo: string;
  showRepeats: boolean;

  // Sorting
  sortField: keyof Finding;
  sortOrder: 'asc' | 'desc';

  // Drawer
  selectedFindingId: string | null;
}

export interface FiltersActions {
  setPage: (page: number) => void;
  setPageSize: (pageSize: number) => void;
  setProductId: (value: string) => void;
  setSearchInput: (value: string) => void;
  setImportJobId: (value: string) => void;
  setFilterSeverity: (value: FindingSeverity | '') => void;
  setFilterStatus: (value: FindingStatus | '') => void;
  setFilterOccurrence: (value: FindingOccurrenceStatus | '') => void;
  setFilterScannerType: (value: string) => void;
  setDateFrom: (value: string) => void;
  setDateTo: (value: string) => void;
  setShowRepeats: (value: boolean) => void;
  setSortField: (value: keyof Finding) => void;
  setSortOrder: (value: 'asc' | 'desc') => void;
  setSelectedFindingId: (value: string | null) => void;
  resetFilters: () => void;
}

const defaultFilters: FiltersState = {
  page: 0,
  pageSize: 20,
  productId: '',
  searchInput: '',
  importJobId: '',
  filterSeverity: '',
  filterStatus: '',
  filterOccurrence: '',
  filterScannerType: '',
  dateFrom: '',
  dateTo: '',
  showRepeats: false,
  sortField: 'lastSeenAt',
  sortOrder: 'desc',
  selectedFindingId: null,
};

/**
 * Custom hook for syncing filters state with URL parameters
 * Replaces 140+ lines of URL sync logic
 */
export function useUrlFiltersSync(): [FiltersState, FiltersActions, boolean] {
  const location = useLocation();
  const navigate = useNavigate();

  const [hydrated, setHydrated] = useState(false);
  const [filters, setFilters] = useState<FiltersState>(defaultFilters);

  // URL -> State (on mount and when URL changes)
  useEffect(() => {
    const search = location.search;

    const page = getUrlParamNumber(search, 'page', 1) - 1;
    const pageSize = getUrlParamNumber(search, 'limit', 20);

    const productIdParam = getUrlParam(search, 'product') || getUrlParam(search, 'productId');
    const importJobId = getUrlParam(search, 'import_job_id');
    const searchInput = getUrlParam(search, 'search') || getUrlParam(search, 'q');
    const scannerType = getUrlParam(search, 'scannerType');
    const dateFrom = getUrlParam(search, 'dateFrom');
    const dateTo = getUrlParam(search, 'dateTo');

    const severity = getUrlParam(search, 'severity');
    const status = getUrlParam(search, 'status');
    const occurrence = getUrlParam(search, 'occurrenceStatus');

    const includeRepeats = getUrlParam(search, 'includeRepeats') === 'true';
    const canonicalOnly = getUrlParam(search, 'canonicalOnly');
    const showRepeats = includeRepeats || canonicalOnly === 'false';

    const sortFieldParam = getUrlParam(search, 'sortField', 'lastSeenAt');
    const allowedSortFields: Array<keyof Finding> = [
      'title',
      'productName',
      'severity',
      'status',
      'lastSeenAt',
      'createdAt',
      'updatedAt',
    ];
    const sortField = allowedSortFields.includes(sortFieldParam as keyof Finding)
      ? (sortFieldParam as keyof Finding)
      : 'lastSeenAt';

    const sortOrder = getUrlParam(search, 'sortOrder') === 'asc' ? 'asc' : 'desc';

    const selectedFindingId = getUrlParam(search, 'selected') || null;

    setFilters({
      page,
      pageSize,
      productId: productIdParam,
      searchInput,
      importJobId,
      filterSeverity: severityOptions.includes(severity as FindingSeverity)
        ? (severity as FindingSeverity)
        : '',
      filterStatus: statusOptions.includes(status as FindingStatus) ? (status as FindingStatus) : '',
      filterOccurrence: occurrenceOptions.includes(occurrence as FindingOccurrenceStatus)
        ? (occurrence as FindingOccurrenceStatus)
        : '',
      filterScannerType: scannerType,
      dateFrom,
      dateTo,
      showRepeats,
      sortField,
      sortOrder,
      selectedFindingId,
    });

    setHydrated(true);
  }, [location.search]);

  // State -> URL (only after hydration)
  useEffect(() => {
    if (!hydrated) return;

    const params = buildQueryString({
      page: filters.page + 1,
      limit: filters.pageSize,
      product: filters.productId,
      severity: filters.filterSeverity,
      status: filters.filterStatus,
      occurrenceStatus: filters.filterOccurrence,
      scannerType: filters.filterScannerType,
      search: filters.searchInput,
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
      import_job_id: filters.importJobId,
      canonicalOnly: !filters.showRepeats,
      includeRepeats: filters.showRepeats,
      sortField: filters.sortField,
      sortOrder: filters.sortOrder,
      selected: filters.selectedFindingId || undefined,
    });

    const currentSearch = location.search.replace(/^\?/, '');

    if (params !== currentSearch) {
      navigate(
        {
          pathname: location.pathname,
          search: params ? `?${params}` : '',
        },
        { replace: true }
      );
    }
  }, [
    hydrated,
    filters,
    location.pathname,
    location.search,
    navigate,
  ]);

  const actions: FiltersActions = {
    setPage: (page) => setFilters((prev) => ({ ...prev, page })),
    setPageSize: (pageSize) => setFilters((prev) => ({ ...prev, pageSize, page: 0 })),
    setProductId: (productId) => setFilters((prev) => ({ ...prev, productId, page: 0 })),
    setSearchInput: (searchInput) => setFilters((prev) => ({ ...prev, searchInput, page: 0 })),
    setImportJobId: (importJobId) => setFilters((prev) => ({ ...prev, importJobId, page: 0 })),
    setFilterSeverity: (filterSeverity) => setFilters((prev) => ({ ...prev, filterSeverity, page: 0 })),
    setFilterStatus: (filterStatus) => setFilters((prev) => ({ ...prev, filterStatus, page: 0 })),
    setFilterOccurrence: (filterOccurrence) => setFilters((prev) => ({ ...prev, filterOccurrence, page: 0 })),
    setFilterScannerType: (filterScannerType) => setFilters((prev) => ({ ...prev, filterScannerType, page: 0 })),
    setDateFrom: (dateFrom) => setFilters((prev) => ({ ...prev, dateFrom, page: 0 })),
    setDateTo: (dateTo) => setFilters((prev) => ({ ...prev, dateTo, page: 0 })),
    setShowRepeats: (showRepeats) => setFilters((prev) => ({ ...prev, showRepeats, page: 0 })),
    setSortField: (sortField) => setFilters((prev) => ({ ...prev, sortField })),
    setSortOrder: (sortOrder) => setFilters((prev) => ({ ...prev, sortOrder })),
    setSelectedFindingId: (selectedFindingId) => setFilters((prev) => ({ ...prev, selectedFindingId })),
    resetFilters: () => setFilters(defaultFilters),
  };

  return [filters, actions, hydrated];
}
