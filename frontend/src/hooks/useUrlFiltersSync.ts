import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  FindingListItemDTO,
  FindingOccurrenceStatus,
  FindingSeverity,
  FindingStatus,
  PolicyDecision,
  RiskBand,
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
const riskBandOptions: RiskBand[] = ['low', 'medium', 'high', 'critical'];

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
  filterRiskBand: RiskBand | '';
  filterOccurrence: FindingOccurrenceStatus | '';
  filterScannerType: string;
  filterPolicyDecision: PolicyDecision | '';
  dateFrom: string;
  dateTo: string;
  showRepeats: boolean;

  // Sorting
  sortField: keyof FindingListItemDTO;
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
  setFilterRiskBand: (value: RiskBand | '') => void;
  setFilterOccurrence: (value: FindingOccurrenceStatus | '') => void;
  setFilterScannerType: (value: string) => void;
  setFilterPolicyDecision: (value: PolicyDecision | '') => void;
  setDateFrom: (value: string) => void;
  setDateTo: (value: string) => void;
  setShowRepeats: (value: boolean) => void;
  setSortField: (value: keyof FindingListItemDTO) => void;
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
  filterRiskBand: '',
  filterOccurrence: '',
  filterScannerType: '',
  filterPolicyDecision: '',
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

  const areFiltersEqual = (left: FiltersState, right: FiltersState) =>
    left.page === right.page &&
    left.pageSize === right.pageSize &&
    left.productId === right.productId &&
    left.searchInput === right.searchInput &&
    left.importJobId === right.importJobId &&
    left.filterSeverity === right.filterSeverity &&
    left.filterStatus === right.filterStatus &&
    left.filterRiskBand === right.filterRiskBand &&
    left.filterOccurrence === right.filterOccurrence &&
    left.filterScannerType === right.filterScannerType &&
    left.filterPolicyDecision === right.filterPolicyDecision &&
    left.dateFrom === right.dateFrom &&
    left.dateTo === right.dateTo &&
    left.showRepeats === right.showRepeats &&
    left.sortField === right.sortField &&
    left.sortOrder === right.sortOrder &&
    left.selectedFindingId === right.selectedFindingId;

  const normalizeSearchParams = (search: string) => {
    const params = new URLSearchParams(search);
    const normalizedEntries: Array<[string, string]> = [];

    params.forEach((value, key) => {
      const normalizedKey = key === 'productId' ? 'product' : key;
      normalizedEntries.push([normalizedKey, value]);
    });

    normalizedEntries.sort(([keyA, valueA], [keyB, valueB]) => {
      if (keyA === keyB) {
        return valueA.localeCompare(valueB);
      }
      return keyA.localeCompare(keyB);
    });

    return normalizedEntries;
  };

  const buildFiltersQuery = (state: FiltersState) =>
    buildQueryString({
      page: state.page + 1,
      limit: state.pageSize,
      product: state.productId,
      severity: state.filterSeverity,
      status: state.filterStatus,
      riskBand: state.filterRiskBand,
      occurrenceStatus: state.filterOccurrence,
      scannerType: state.filterScannerType,
      policyDecision: state.filterPolicyDecision,
      search: state.searchInput,
      dateFrom: state.dateFrom,
      dateTo: state.dateTo,
      import_job_id: state.importJobId,
      canonicalOnly: !state.showRepeats,
      includeRepeats: state.showRepeats,
      sortField: state.sortField,
      sortOrder: state.sortOrder,
      selected: state.selectedFindingId || undefined,
    });

  const areSearchParamsEqual = (left: string, right: string) => {
    const leftParams = normalizeSearchParams(left);
    const rightParams = normalizeSearchParams(right);
    return (
      leftParams.length === rightParams.length &&
      leftParams.every(([key, value], index) => {
        const [rightKey, rightValue] = rightParams[index];
        return key === rightKey && value === rightValue;
      })
    );
  };

  // URL -> State (on mount and when URL changes)
  useEffect(() => {
    const search = location.search;

    const page = getUrlParamNumber(search, 'page', 1) - 1;
    const pageSize = getUrlParamNumber(search, 'limit', 20);

    const productIdParam = getUrlParam(search, 'product') || getUrlParam(search, 'productId');
    const importJobId = getUrlParam(search, 'import_job_id');
    const searchInput = getUrlParam(search, 'search') || getUrlParam(search, 'q');
    const scannerType = getUrlParam(search, 'scannerType');
    const policyDecision = getUrlParam(search, 'policyDecision');
    const dateFrom = getUrlParam(search, 'dateFrom');
    const dateTo = getUrlParam(search, 'dateTo');

    const severity = getUrlParam(search, 'severity');
    const status = getUrlParam(search, 'status');
    const riskBand = getUrlParam(search, 'riskBand');
    const occurrence = getUrlParam(search, 'occurrenceStatus');
    const decisionOptions: PolicyDecision[] = ['pass', 'fail', 'warn'];

    const includeRepeats = getUrlParam(search, 'includeRepeats') === 'true';
    const canonicalOnly = getUrlParam(search, 'canonicalOnly');
    const showRepeats = includeRepeats || canonicalOnly === 'false';

    const sortFieldParam = getUrlParam(search, 'sortField', 'lastSeenAt');
    const allowedSortFields: Array<keyof FindingListItemDTO> = [
      'title',
      'productName',
      'severity',
      'status',
      'riskScore',
      'slaDueAt',
      'lastSeenAt',
      'createdAt',
      'updatedAt',
    ];
    const sortField = allowedSortFields.includes(sortFieldParam as keyof FindingListItemDTO)
      ? (sortFieldParam as keyof FindingListItemDTO)
      : 'lastSeenAt';

    const sortOrder = getUrlParam(search, 'sortOrder') === 'asc' ? 'asc' : 'desc';

    const selectedFindingId = getUrlParam(search, 'selected') || null;

    const nextFilters: FiltersState = {
      page,
      pageSize,
      productId: productIdParam,
      searchInput,
      importJobId,
      filterSeverity: severityOptions.includes(severity as FindingSeverity)
        ? (severity as FindingSeverity)
        : '',
      filterStatus: statusOptions.includes(status as FindingStatus) ? (status as FindingStatus) : '',
      filterRiskBand: riskBandOptions.includes(riskBand as RiskBand) ? (riskBand as RiskBand) : '',
      filterOccurrence: occurrenceOptions.includes(occurrence as FindingOccurrenceStatus)
        ? (occurrence as FindingOccurrenceStatus)
        : '',
      filterScannerType: scannerType,
      filterPolicyDecision: decisionOptions.includes(policyDecision as PolicyDecision)
        ? (policyDecision as PolicyDecision)
        : '',
      dateFrom,
      dateTo,
      showRepeats,
      sortField,
      sortOrder,
      selectedFindingId,
    };

    setFilters((prev) => (areFiltersEqual(prev, nextFilters) ? prev : nextFilters));

    setHydrated(true);
  }, [location.search]);

  // State -> URL (only after hydration)
  useEffect(() => {
    if (!hydrated) return;

    const params = buildFiltersQuery(filters);
    const defaultParams = buildFiltersQuery(defaultFilters);

    const shouldSkipDefaultNavigation =
      location.search === '' && areSearchParamsEqual(params, defaultParams);

    const shouldNavigate = !shouldSkipDefaultNavigation && !areSearchParamsEqual(location.search, params);

    if (shouldNavigate) {
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
    setFilterRiskBand: (filterRiskBand) => setFilters((prev) => ({ ...prev, filterRiskBand, page: 0 })),
    setFilterOccurrence: (filterOccurrence) => setFilters((prev) => ({ ...prev, filterOccurrence, page: 0 })),
    setFilterScannerType: (filterScannerType) => setFilters((prev) => ({ ...prev, filterScannerType, page: 0 })),
    setFilterPolicyDecision: (filterPolicyDecision) => setFilters((prev) => ({ ...prev, filterPolicyDecision, page: 0 })),
    setDateFrom: (dateFrom) => setFilters((prev) => ({ ...prev, dateFrom, page: 0 })),
    setDateTo: (dateTo) => setFilters((prev) => ({ ...prev, dateTo, page: 0 })),
    setShowRepeats: (showRepeats) => setFilters((prev) => ({ ...prev, showRepeats, page: 0 })),
    setSortField: (sortField) => setFilters((prev) => ({ ...prev, sortField, page: 0 })),
    setSortOrder: (sortOrder) => setFilters((prev) => ({ ...prev, sortOrder, page: 0 })),
    setSelectedFindingId: (selectedFindingId) => setFilters((prev) => ({ ...prev, selectedFindingId })),
    resetFilters: () => setFilters(defaultFilters),
  };

  return [filters, actions, hydrated];
}
