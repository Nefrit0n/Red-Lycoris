/**
 * VirtualizedDataTable Component
 *
 * High-performance table component using react-window for virtualization.
 * Efficiently renders large datasets by only mounting visible rows.
 *
 * @example
 * <VirtualizedDataTable
 *   data={findings}
 *   rowHeight={56}
 *   headerHeight={48}
 *   renderRow={({ index, style, data }) => (
 *     <TableRow style={style}>{...}</TableRow>
 *   )}
 *   renderHeader={() => <TableHead>...</TableHead>}
 * />
 */

import React, { memo, useCallback, useMemo, forwardRef, CSSProperties } from 'react';
import { FixedSizeList as List, ListChildComponentProps, areEqual } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';
import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Skeleton,
  Typography,
  Stack,
} from '@mui/material';
import { tableStyles } from '../design-system/utils/tableStyles';

// ============================================================
// TYPES
// ============================================================

export interface VirtualizedRowProps<T> {
  /** Row index */
  index: number;
  /** Inline style (must be applied for virtualization) */
  style: CSSProperties;
  /** Row data item */
  data: T;
  /** Whether the row is selected */
  isSelected?: boolean;
  /** Whether the row is active (e.g., open in drawer) */
  isActive?: boolean;
}

export interface VirtualizedDataTableProps<T> {
  /** Data array to render */
  data: T[];
  /** Height of each row in pixels */
  rowHeight?: number;
  /** Height of the header in pixels */
  headerHeight?: number;
  /** Minimum width of the table */
  minWidth?: number;
  /** Maximum height of the table container */
  maxHeight?: number | string;
  /** Function to render each row */
  renderRow: (props: VirtualizedRowProps<T>) => React.ReactNode;
  /** Function to render the header */
  renderHeader: () => React.ReactNode;
  /** Selected row IDs */
  selectedIds?: Set<string>;
  /** Active row ID */
  activeId?: string | null;
  /** Get unique key for row */
  getRowKey: (item: T, index: number) => string;
  /** Loading state */
  loading?: boolean;
  /** Number of skeleton rows to show while loading */
  loadingRowCount?: number;
  /** Number of columns (for skeleton) */
  columnCount?: number;
  /** Empty state content */
  emptyState?: React.ReactNode;
  /** Whether to enable zebra striping */
  zebra?: boolean;
  /** Additional className */
  className?: string;
  /** Overscan count (rows to render outside visible area) */
  overscanCount?: number;
  /** Accessibility label for the table */
  'aria-label'?: string;
}

// ============================================================
// INNER ROW COMPONENT (Memoized)
// ============================================================

interface InnerRowProps<T> extends ListChildComponentProps {
  data: {
    items: T[];
    renderRow: VirtualizedDataTableProps<T>['renderRow'];
    selectedIds?: Set<string>;
    activeId?: string | null;
    getRowKey: VirtualizedDataTableProps<T>['getRowKey'];
  };
}

const InnerRow = memo(function InnerRow<T>({ index, style, data }: InnerRowProps<T>) {
  const { items, renderRow, selectedIds, activeId, getRowKey } = data;
  const item = items[index];
  const key = getRowKey(item, index);
  const isSelected = selectedIds?.has(key) ?? false;
  const isActive = activeId === key;

  return (
    <>
      {renderRow({
        index,
        style,
        data: item,
        isSelected,
        isActive,
      })}
    </>
  );
}, areEqual) as <T>(props: InnerRowProps<T>) => JSX.Element;

// ============================================================
// OUTER CONTAINER (for proper table structure)
// ============================================================

const OuterContainer = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ children, ...props }, ref) => (
    <TableBody
      ref={ref}
      component="div"
      {...props}
      sx={{
        display: 'block',
        position: 'relative',
      }}
    >
      {children}
    </TableBody>
  )
);
OuterContainer.displayName = 'OuterContainer';

// ============================================================
// INNER CONTAINER
// ============================================================

const InnerContainer = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ children, style, ...props }, ref) => (
    <div
      ref={ref}
      style={style}
      {...props}
    >
      {children}
    </div>
  )
);
InnerContainer.displayName = 'InnerContainer';

// ============================================================
// LOADING SKELETON
// ============================================================

interface LoadingSkeletonProps {
  rowCount: number;
  columnCount: number;
  rowHeight: number;
}

const LoadingSkeleton = memo(function LoadingSkeleton({
  rowCount,
  columnCount,
  rowHeight,
}: LoadingSkeletonProps) {
  return (
    <TableBody>
      {Array.from({ length: rowCount }).map((_, rowIndex) => (
        <TableRow
          key={`skeleton-${rowIndex}`}
          sx={{ height: rowHeight }}
        >
          {Array.from({ length: columnCount }).map((__, colIndex) => (
            <TableCell key={`skeleton-${rowIndex}-${colIndex}`}>
              {colIndex === 0 ? (
                <Skeleton variant="rectangular" width={18} height={18} />
              ) : (
                <Skeleton width="70%" />
              )}
            </TableCell>
          ))}
        </TableRow>
      ))}
    </TableBody>
  );
});

// ============================================================
// EMPTY STATE
// ============================================================

interface EmptyStateProps {
  columnCount: number;
  children?: React.ReactNode;
}

const EmptyState = memo(function EmptyState({ columnCount, children }: EmptyStateProps) {
  return (
    <TableBody>
      <TableRow>
        <TableCell
          colSpan={columnCount}
          align="center"
          sx={{ py: 8 }}
        >
          {children || (
            <Stack spacing={1} alignItems="center">
              <Typography variant="h6" color="text.secondary">
                No data available
              </Typography>
              <Typography variant="body2" color="text.disabled">
                Try adjusting your filters or search criteria
              </Typography>
            </Stack>
          )}
        </TableCell>
      </TableRow>
    </TableBody>
  );
});

// ============================================================
// MAIN COMPONENT
// ============================================================

function VirtualizedDataTableInner<T>(
  {
    data,
    rowHeight = 56,
    headerHeight = 48,
    minWidth = 760,
    maxHeight = '70vh',
    renderRow,
    renderHeader,
    selectedIds,
    activeId,
    getRowKey,
    loading = false,
    loadingRowCount = 10,
    columnCount = 7,
    emptyState,
    zebra = false,
    className,
    overscanCount = 5,
    'aria-label': ariaLabel,
  }: VirtualizedDataTableProps<T>,
  ref: React.ForwardedRef<HTMLDivElement>
) {
  // Memoize item data for react-window
  const itemData = useMemo(
    () => ({
      items: data,
      renderRow,
      selectedIds,
      activeId,
      getRowKey,
    }),
    [data, renderRow, selectedIds, activeId, getRowKey]
  );

  // Calculate container height
  const containerHeight = useMemo(() => {
    if (typeof maxHeight === 'number') return maxHeight;
    // For string values like '70vh', return undefined to use AutoSizer
    return undefined;
  }, [maxHeight]);

  return (
    <TableContainer
      ref={ref}
      className={className}
      sx={{
        borderRadius: 2,
        border: '1px solid',
        borderColor: 'divider',
        backgroundColor: 'background.paper',
        height: containerHeight ?? maxHeight,
        // Header styles
        '& .MuiTableCell-head': {
          backgroundColor: tableStyles.headerBg,
          color: tableStyles.headerText,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          fontSize: '0.7rem',
          borderBottom: `1px solid ${tableStyles.cellBorder}`,
          whiteSpace: 'nowrap',
          py: tableStyles.cellPaddingY,
          px: tableStyles.cellPaddingX,
        },
        // Body cell styles
        '& .MuiTableCell-body': {
          borderBottom: `1px solid ${tableStyles.cellBorder}`,
          fontSize: '0.875rem',
          py: tableStyles.cellPaddingY,
          px: tableStyles.cellPaddingX,
        },
        // Row styles
        '& .MuiTableRow-root': {
          transition: 'background-color 0.15s ease',
          '@media (prefers-reduced-motion: reduce)': {
            transition: 'none',
          },
          '&:hover': {
            backgroundColor: tableStyles.rowHover,
          },
          '&.Mui-selected': {
            backgroundColor: tableStyles.rowSelected,
            '&:hover': {
              backgroundColor: tableStyles.rowSelected,
            },
          },
        },
        // Zebra striping
        ...(zebra && {
          '& .virtualized-row:nth-of-type(even)': {
            backgroundColor: tableStyles.rowZebra,
          },
        }),
      }}
      role="region"
      aria-label={ariaLabel}
    >
      <Table
        stickyHeader
        size="small"
        sx={{
          minWidth,
          tableLayout: 'fixed',
        }}
        aria-label={ariaLabel}
      >
        {/* Fixed Header */}
        {renderHeader()}

        {/* Loading State */}
        {loading && (
          <LoadingSkeleton
            rowCount={loadingRowCount}
            columnCount={columnCount}
            rowHeight={rowHeight}
          />
        )}

        {/* Empty State */}
        {!loading && data.length === 0 && (
          <EmptyState columnCount={columnCount}>
            {emptyState}
          </EmptyState>
        )}

        {/* Virtualized Rows */}
        {!loading && data.length > 0 && (
          <Box
            component="div"
            sx={{
              flex: 1,
              minHeight: 0,
              // Account for header
              height: `calc(100% - ${headerHeight}px)`,
            }}
          >
            <AutoSizer>
              {({ height, width }) => (
                <List
                  height={height}
                  width={width}
                  itemCount={data.length}
                  itemSize={rowHeight}
                  itemData={itemData}
                  overscanCount={overscanCount}
                  outerElementType={OuterContainer}
                  innerElementType={InnerContainer}
                >
                  {InnerRow as React.ComponentType<ListChildComponentProps>}
                </List>
              )}
            </AutoSizer>
          </Box>
        )}
      </Table>
    </TableContainer>
  );
}

// Forward ref with generic support
export const VirtualizedDataTable = forwardRef(VirtualizedDataTableInner) as <T>(
  props: VirtualizedDataTableProps<T> & { ref?: React.ForwardedRef<HTMLDivElement> }
) => JSX.Element;

export default VirtualizedDataTable;
