# Smart Views & Saved Filters Specification

## Overview

Smart Views - это система предустановленных и пользовательских фильтров для быстрой навигации по findings. Цель - сократить время на поиск нужных данных и ускорить процесс триажа.

---

## 1. User Stories

### As a Security Analyst:
- Я хочу быстро переключаться между "своей очередью" и "критичными уязвимостями"
- Я хочу сохранять свои кастомные фильтры для повторного использования
- Я хочу видеть количество items в каждом view в реальном времени

### As a Security Lead:
- Я хочу видеть findings с нарушенным SLA одним кликом
- Я хочу создавать views для команды (shared views)
- Я хочу мониторить KEV уязвимости отдельно

---

## 2. Types & Interfaces

```typescript
// File: src/types/views.ts

export interface FilterState {
  // Severity
  severity?: ('low' | 'medium' | 'high' | 'critical')[];

  // Status
  status?: FindingStatus[];

  // Products
  productId?: string[];

  // Risk
  riskBand?: ('low' | 'medium' | 'high' | 'critical')[];
  riskScoreMin?: number;
  riskScoreMax?: number;

  // SLA
  slaBreached?: boolean;
  slaDaysRemaining?: { min?: number; max?: number };

  // Intelligence
  kev?: boolean;
  epssPercentileMin?: number;
  cvssScoreMin?: number;

  // Category
  category?: ('SAST' | 'SCA' | 'SECRETS' | 'CONFIG' | 'DAST' | 'LICENSE')[];

  // Assignment
  assigneeId?: string | 'current_user' | 'unassigned';

  // Scanner
  sourceType?: string[];

  // Date range
  dateFrom?: string;  // ISO date
  dateTo?: string;

  // Search
  search?: string;

  // Policy
  policyDecision?: ('pass' | 'fail' | 'warn')[];

  // Occurrence
  occurrenceStatus?: 'NEW' | 'REPEAT';
  repeatCountMin?: number;
}

export interface SavedView {
  id: string;
  name: string;
  icon?: string;          // MUI icon name
  iconColor?: string;     // hex color
  filters: FilterState;
  sorting?: {
    field: string;
    order: 'asc' | 'desc';
  };
  columns?: string[];     // Visible columns
  isSystem?: boolean;     // Cannot be deleted
  isShared?: boolean;     // Visible to all users
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
  order?: number;         // Display order
}

export interface ViewWithCount extends SavedView {
  count: number;          // Current matching count
  countLoading?: boolean;
}

export type ViewBadgeType = 'count' | 'alert' | 'none';

export interface ViewBadgeConfig {
  type: ViewBadgeType;
  showWhenZero?: boolean;
  alertThreshold?: number;  // Show as alert when count >= threshold
}
```

---

## 3. System Views (Predefined)

```typescript
// File: src/config/systemViews.ts

import { SavedView } from '../types/views';

export const SYSTEM_VIEWS: SavedView[] = [
  // ==================== TRIAGE VIEWS ====================
  {
    id: 'my-queue',
    name: 'My Queue',
    icon: 'Inbox',
    iconColor: '#2196f3',
    filters: {
      assigneeId: 'current_user',
      status: ['new', 'under_review'],
    },
    sorting: { field: 'riskScore', order: 'desc' },
    isSystem: true,
    order: 1,
  },
  {
    id: 'needs-triage',
    name: 'Needs Triage',
    icon: 'PriorityHigh',
    iconColor: '#ff9800',
    filters: {
      status: ['new'],
      assigneeId: 'unassigned',
    },
    sorting: { field: 'riskScore', order: 'desc' },
    isSystem: true,
    order: 2,
  },
  {
    id: 'unassigned',
    name: 'Unassigned',
    icon: 'PersonOff',
    iconColor: '#9e9e9e',
    filters: {
      assigneeId: 'unassigned',
      status: ['new', 'under_review', 'confirmed'],
    },
    isSystem: true,
    order: 3,
  },

  // ==================== PRIORITY VIEWS ====================
  {
    id: 'critical-all',
    name: 'All Critical',
    icon: 'Error',
    iconColor: '#d32f2f',
    filters: {
      severity: ['critical'],
      status: ['new', 'under_review', 'confirmed'],
    },
    sorting: { field: 'createdAt', order: 'desc' },
    isSystem: true,
    order: 10,
  },
  {
    id: 'critical-high',
    name: 'Critical & High',
    icon: 'Warning',
    iconColor: '#f57c00',
    filters: {
      severity: ['critical', 'high'],
      status: ['new', 'under_review', 'confirmed'],
    },
    isSystem: true,
    order: 11,
  },
  {
    id: 'high-risk',
    name: 'High Risk Score',
    icon: 'TrendingUp',
    iconColor: '#d32f2f',
    filters: {
      riskScoreMin: 80,
      status: ['new', 'under_review', 'confirmed'],
    },
    sorting: { field: 'riskScore', order: 'desc' },
    isSystem: true,
    order: 12,
  },

  // ==================== SLA VIEWS ====================
  {
    id: 'sla-breached',
    name: 'SLA Breached',
    icon: 'AlarmOff',
    iconColor: '#d32f2f',
    filters: {
      slaBreached: true,
      status: ['new', 'under_review', 'confirmed'],
    },
    sorting: { field: 'slaDueAt', order: 'asc' },
    isSystem: true,
    order: 20,
  },
  {
    id: 'sla-urgent',
    name: 'SLA Due Soon',
    icon: 'Alarm',
    iconColor: '#ff9800',
    filters: {
      slaDaysRemaining: { min: 0, max: 3 },
      status: ['new', 'under_review', 'confirmed'],
    },
    sorting: { field: 'slaDueAt', order: 'asc' },
    isSystem: true,
    order: 21,
  },
  {
    id: 'sla-this-week',
    name: 'Due This Week',
    icon: 'CalendarToday',
    iconColor: '#fbc02d',
    filters: {
      slaDaysRemaining: { min: 0, max: 7 },
      status: ['new', 'under_review', 'confirmed'],
    },
    isSystem: true,
    order: 22,
  },

  // ==================== INTELLIGENCE VIEWS ====================
  {
    id: 'kev-active',
    name: 'KEV Active',
    icon: 'Security',
    iconColor: '#d32f2f',
    filters: {
      kev: true,
      status: ['new', 'under_review', 'confirmed'],
    },
    sorting: { field: 'riskScore', order: 'desc' },
    isSystem: true,
    order: 30,
  },
  {
    id: 'highly-exploitable',
    name: 'Highly Exploitable',
    icon: 'BugReport',
    iconColor: '#ff5722',
    filters: {
      epssPercentileMin: 90,
      status: ['new', 'under_review', 'confirmed'],
    },
    isSystem: true,
    order: 31,
  },

  // ==================== CATEGORY VIEWS ====================
  {
    id: 'category-sast',
    name: 'SAST Findings',
    icon: 'Code',
    iconColor: '#9c27b0',
    filters: {
      category: ['SAST'],
      status: ['new', 'under_review', 'confirmed'],
    },
    isSystem: true,
    order: 40,
  },
  {
    id: 'category-sca',
    name: 'SCA Findings',
    icon: 'Extension',
    iconColor: '#00bcd4',
    filters: {
      category: ['SCA'],
      status: ['new', 'under_review', 'confirmed'],
    },
    isSystem: true,
    order: 41,
  },
  {
    id: 'category-secrets',
    name: 'Secrets',
    icon: 'VpnKey',
    iconColor: '#f44336',
    filters: {
      category: ['SECRETS'],
      status: ['new', 'under_review', 'confirmed'],
    },
    isSystem: true,
    order: 42,
  },

  // ==================== STATUS VIEWS ====================
  {
    id: 'status-confirmed',
    name: 'Confirmed',
    icon: 'CheckCircle',
    iconColor: '#4caf50',
    filters: {
      status: ['confirmed'],
    },
    isSystem: true,
    order: 50,
  },
  {
    id: 'status-mitigated',
    name: 'Recently Fixed',
    icon: 'Done',
    iconColor: '#66bb6a',
    filters: {
      status: ['mitigated'],
      dateFrom: getWeekAgo(),
    },
    sorting: { field: 'updatedAt', order: 'desc' },
    isSystem: true,
    order: 51,
  },

  // ==================== TIME-BASED VIEWS ====================
  {
    id: 'new-today',
    name: 'New Today',
    icon: 'Today',
    iconColor: '#2196f3',
    filters: {
      status: ['new'],
      dateFrom: getTodayDate(),
    },
    sorting: { field: 'createdAt', order: 'desc' },
    isSystem: true,
    order: 60,
  },
  {
    id: 'new-this-week',
    name: 'New This Week',
    icon: 'DateRange',
    iconColor: '#2196f3',
    filters: {
      status: ['new'],
      dateFrom: getWeekAgo(),
    },
    isSystem: true,
    order: 61,
  },
];

function getTodayDate(): string {
  return new Date().toISOString().split('T')[0];
}

function getWeekAgo(): string {
  const date = new Date();
  date.setDate(date.getDate() - 7);
  return date.toISOString().split('T')[0];
}
```

---

## 4. Smart Views Component

```tsx
// File: src/components/findings/SmartViewsBar.tsx

import React, { useState, useMemo } from 'react';
import {
  Box, Tabs, Tab, Badge, IconButton, Menu, MenuItem,
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Button, Typography, Chip, Tooltip,
  Collapse, Divider
} from '@mui/material';
import {
  Add as AddIcon,
  ExpandMore as ExpandIcon,
  ExpandLess as CollapseIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Share as ShareIcon,
  Star as StarIcon,
  StarBorder as StarBorderIcon,
} from '@mui/icons-material';
import * as Icons from '@mui/icons-material';
import { SavedView, ViewWithCount } from '../../types/views';

interface SmartViewsBarProps {
  views: ViewWithCount[];
  activeViewId: string | null;
  onViewChange: (viewId: string | null) => void;
  onCreateView: (view: Omit<SavedView, 'id'>) => Promise<void>;
  onUpdateView: (id: string, updates: Partial<SavedView>) => Promise<void>;
  onDeleteView: (id: string) => Promise<void>;
  currentFilters: FilterState;
  favoriteViewIds: string[];
  onToggleFavorite: (viewId: string) => void;
}

interface ViewCategory {
  id: string;
  label: string;
  views: ViewWithCount[];
}

export const SmartViewsBar: React.FC<SmartViewsBarProps> = ({
  views,
  activeViewId,
  onViewChange,
  onCreateView,
  onUpdateView,
  onDeleteView,
  currentFilters,
  favoriteViewIds,
  onToggleFavorite,
}) => {
  const [expanded, setExpanded] = useState(true);
  const [showAllViews, setShowAllViews] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newViewName, setNewViewName] = useState('');
  const [contextMenu, setContextMenu] = useState<{
    anchor: HTMLElement;
    view: ViewWithCount;
  } | null>(null);

  // Group views by category
  const categorizedViews = useMemo(() => {
    const categories: ViewCategory[] = [
      {
        id: 'favorites',
        label: 'Favorites',
        views: views.filter(v => favoriteViewIds.includes(v.id)),
      },
      {
        id: 'triage',
        label: 'Triage',
        views: views.filter(v => v.order && v.order < 10),
      },
      {
        id: 'priority',
        label: 'Priority',
        views: views.filter(v => v.order && v.order >= 10 && v.order < 20),
      },
      {
        id: 'sla',
        label: 'SLA',
        views: views.filter(v => v.order && v.order >= 20 && v.order < 30),
      },
      {
        id: 'intel',
        label: 'Intelligence',
        views: views.filter(v => v.order && v.order >= 30 && v.order < 40),
      },
      {
        id: 'custom',
        label: 'My Views',
        views: views.filter(v => !v.isSystem),
      },
    ];

    return categories.filter(c => c.views.length > 0);
  }, [views, favoriteViewIds]);

  // Quick access views (favorites + first few system views)
  const quickAccessViews = useMemo(() => {
    const favorites = views.filter(v => favoriteViewIds.includes(v.id));
    const systemTop = views
      .filter(v => v.isSystem && !favoriteViewIds.includes(v.id))
      .slice(0, 5 - favorites.length);
    return [...favorites, ...systemTop];
  }, [views, favoriteViewIds]);

  const getIcon = (iconName?: string) => {
    if (!iconName) return null;
    const IconComponent = (Icons as any)[iconName];
    return IconComponent ? <IconComponent fontSize="small" /> : null;
  };

  const handleCreateView = async () => {
    if (!newViewName.trim()) return;

    await onCreateView({
      name: newViewName,
      filters: currentFilters,
      isSystem: false,
      isShared: false,
    });

    setNewViewName('');
    setCreateDialogOpen(false);
  };

  const handleContextMenu = (event: React.MouseEvent, view: ViewWithCount) => {
    event.preventDefault();
    setContextMenu({ anchor: event.currentTarget as HTMLElement, view });
  };

  const renderViewTab = (view: ViewWithCount, showCategory = false) => {
    const isFavorite = favoriteViewIds.includes(view.id);
    const isActive = activeViewId === view.id;

    return (
      <Tooltip
        key={view.id}
        title={
          <Box>
            <Typography variant="body2">{view.name}</Typography>
            {view.count > 0 && (
              <Typography variant="caption" color="text.secondary">
                {view.count} findings
              </Typography>
            )}
          </Box>
        }
      >
        <Tab
          value={view.id}
          onContextMenu={(e) => handleContextMenu(e, view)}
          sx={{
            minHeight: 40,
            textTransform: 'none',
            '&.Mui-selected': {
              bgcolor: 'action.selected',
            },
          }}
          label={
            <Box display="flex" alignItems="center" gap={0.5}>
              {view.icon && (
                <Box sx={{ color: view.iconColor || 'inherit' }}>
                  {getIcon(view.icon)}
                </Box>
              )}
              <span>{view.name}</span>
              {view.count > 0 && (
                <Chip
                  size="small"
                  label={view.count}
                  sx={{
                    height: 18,
                    fontSize: 11,
                    ml: 0.5,
                    bgcolor: isActive ? 'primary.main' : 'action.hover',
                  }}
                />
              )}
            </Box>
          }
        />
      </Tooltip>
    );
  };

  return (
    <Box sx={{ bgcolor: 'background.paper', borderRadius: 1, mb: 2 }}>
      {/* Quick Access Bar */}
      <Box display="flex" alignItems="center" px={1}>
        <Tabs
          value={activeViewId || false}
          onChange={(_, newValue) => onViewChange(newValue || null)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ flex: 1 }}
        >
          <Tab
            value={false}
            label="All Findings"
            sx={{ minHeight: 40, textTransform: 'none' }}
          />
          {quickAccessViews.map(view => renderViewTab(view))}
        </Tabs>

        <IconButton
          size="small"
          onClick={() => setShowAllViews(!showAllViews)}
          sx={{ ml: 1 }}
        >
          {showAllViews ? <CollapseIcon /> : <ExpandIcon />}
        </IconButton>

        <Tooltip title="Save current filters as view">
          <IconButton
            size="small"
            onClick={() => setCreateDialogOpen(true)}
          >
            <AddIcon />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Expanded View Categories */}
      <Collapse in={showAllViews}>
        <Divider />
        <Box p={2}>
          {categorizedViews.map(category => (
            <Box key={category.id} mb={2}>
              <Typography
                variant="overline"
                color="text.secondary"
                display="block"
                mb={1}
              >
                {category.label}
              </Typography>
              <Box display="flex" gap={1} flexWrap="wrap">
                {category.views.map(view => (
                  <Chip
                    key={view.id}
                    icon={
                      <Box sx={{ color: view.iconColor || 'inherit', display: 'flex' }}>
                        {getIcon(view.icon)}
                      </Box>
                    }
                    label={
                      <Box display="flex" alignItems="center" gap={0.5}>
                        {view.name}
                        {view.count > 0 && (
                          <Typography
                            component="span"
                            variant="caption"
                            sx={{
                              bgcolor: 'action.selected',
                              px: 0.5,
                              borderRadius: 1,
                            }}
                          >
                            {view.count}
                          </Typography>
                        )}
                      </Box>
                    }
                    onClick={() => {
                      onViewChange(view.id);
                      setShowAllViews(false);
                    }}
                    onDelete={
                      !view.isSystem
                        ? () => onDeleteView(view.id)
                        : undefined
                    }
                    variant={activeViewId === view.id ? 'filled' : 'outlined'}
                    color={activeViewId === view.id ? 'primary' : 'default'}
                  />
                ))}
              </Box>
            </Box>
          ))}
        </Box>
      </Collapse>

      {/* Context Menu */}
      <Menu
        open={Boolean(contextMenu)}
        anchorEl={contextMenu?.anchor}
        onClose={() => setContextMenu(null)}
      >
        <MenuItem
          onClick={() => {
            if (contextMenu) {
              onToggleFavorite(contextMenu.view.id);
              setContextMenu(null);
            }
          }}
        >
          {contextMenu && favoriteViewIds.includes(contextMenu.view.id) ? (
            <>
              <StarBorderIcon fontSize="small" sx={{ mr: 1 }} />
              Remove from Favorites
            </>
          ) : (
            <>
              <StarIcon fontSize="small" sx={{ mr: 1 }} />
              Add to Favorites
            </>
          )}
        </MenuItem>
        {!contextMenu?.view.isSystem && (
          <>
            <MenuItem
              onClick={() => {
                // TODO: Open edit dialog
                setContextMenu(null);
              }}
            >
              <EditIcon fontSize="small" sx={{ mr: 1 }} />
              Edit View
            </MenuItem>
            <MenuItem
              onClick={() => {
                if (contextMenu) {
                  onDeleteView(contextMenu.view.id);
                  setContextMenu(null);
                }
              }}
            >
              <DeleteIcon fontSize="small" sx={{ mr: 1 }} />
              Delete View
            </MenuItem>
          </>
        )}
      </Menu>

      {/* Create View Dialog */}
      <Dialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Save Current Filters as View</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            margin="dense"
            label="View Name"
            value={newViewName}
            onChange={(e) => setNewViewName(e.target.value)}
            placeholder="e.g., Auth Team Issues"
          />
          <Typography variant="caption" color="text.secondary" display="block" mt={2}>
            Current filters will be saved:
          </Typography>
          <Box mt={1} display="flex" gap={0.5} flexWrap="wrap">
            {Object.entries(currentFilters).map(([key, value]) => {
              if (!value) return null;
              const displayValue = Array.isArray(value)
                ? value.join(', ')
                : String(value);
              return (
                <Chip
                  key={key}
                  size="small"
                  label={`${key}: ${displayValue}`}
                  variant="outlined"
                />
              );
            })}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleCreateView}
            variant="contained"
            disabled={!newViewName.trim()}
          >
            Save View
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
```

---

## 5. Hook: useSavedViews

```typescript
// File: src/hooks/useSavedViews.ts

import { useState, useEffect, useCallback, useMemo } from 'react';
import { SavedView, ViewWithCount, FilterState } from '../types/views';
import { SYSTEM_VIEWS } from '../config/systemViews';
import { fetchFindingsCount } from '../api/findings';

const STORAGE_KEY = 'red_lycoris_saved_views';
const FAVORITES_KEY = 'red_lycoris_favorite_views';

interface UseSavedViewsResult {
  views: ViewWithCount[];
  activeView: SavedView | null;
  activeViewId: string | null;
  setActiveViewId: (id: string | null) => void;
  createView: (view: Omit<SavedView, 'id'>) => Promise<SavedView>;
  updateView: (id: string, updates: Partial<SavedView>) => Promise<void>;
  deleteView: (id: string) => Promise<void>;
  favoriteViewIds: string[];
  toggleFavorite: (viewId: string) => void;
  refreshCounts: () => Promise<void>;
  loading: boolean;
}

export const useSavedViews = (): UseSavedViewsResult => {
  const [customViews, setCustomViews] = useState<SavedView[]>([]);
  const [activeViewId, setActiveViewId] = useState<string | null>(null);
  const [viewCounts, setViewCounts] = useState<Record<string, number>>({});
  const [favoriteViewIds, setFavoriteViewIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setCustomViews(JSON.parse(stored));
      }

      const favorites = localStorage.getItem(FAVORITES_KEY);
      if (favorites) {
        setFavoriteViewIds(JSON.parse(favorites));
      }
    } catch (error) {
      console.error('Failed to load saved views:', error);
    }
  }, []);

  // Save custom views to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(customViews));
    } catch (error) {
      console.error('Failed to save views:', error);
    }
  }, [customViews]);

  // Save favorites to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(favoriteViewIds));
    } catch (error) {
      console.error('Failed to save favorites:', error);
    }
  }, [favoriteViewIds]);

  // Combine system and custom views
  const allViews = useMemo<SavedView[]>(() => {
    return [...SYSTEM_VIEWS, ...customViews].sort((a, b) =>
      (a.order || 999) - (b.order || 999)
    );
  }, [customViews]);

  // Views with counts
  const viewsWithCounts = useMemo<ViewWithCount[]>(() => {
    return allViews.map(view => ({
      ...view,
      count: viewCounts[view.id] || 0,
      countLoading: loading,
    }));
  }, [allViews, viewCounts, loading]);

  // Active view
  const activeView = useMemo(() => {
    return allViews.find(v => v.id === activeViewId) || null;
  }, [allViews, activeViewId]);

  // Fetch counts for all views
  const refreshCounts = useCallback(async () => {
    setLoading(true);

    try {
      const counts = await Promise.all(
        allViews.map(async (view) => {
          try {
            const count = await fetchFindingsCount(view.filters);
            return { id: view.id, count };
          } catch {
            return { id: view.id, count: 0 };
          }
        })
      );

      const countsMap: Record<string, number> = {};
      counts.forEach(({ id, count }) => {
        countsMap[id] = count;
      });

      setViewCounts(countsMap);
    } catch (error) {
      console.error('Failed to fetch view counts:', error);
    } finally {
      setLoading(false);
    }
  }, [allViews]);

  // Initial load
  useEffect(() => {
    refreshCounts();
  }, []);

  // Create view
  const createView = useCallback(async (
    viewData: Omit<SavedView, 'id'>
  ): Promise<SavedView> => {
    const newView: SavedView = {
      ...viewData,
      id: `custom-${Date.now()}`,
      createdAt: new Date().toISOString(),
      order: 100 + customViews.length,
    };

    setCustomViews(prev => [...prev, newView]);

    // Fetch count for new view
    try {
      const count = await fetchFindingsCount(newView.filters);
      setViewCounts(prev => ({ ...prev, [newView.id]: count }));
    } catch {
      // Ignore error
    }

    return newView;
  }, [customViews.length]);

  // Update view
  const updateView = useCallback(async (
    id: string,
    updates: Partial<SavedView>
  ): Promise<void> => {
    setCustomViews(prev =>
      prev.map(view =>
        view.id === id
          ? { ...view, ...updates, updatedAt: new Date().toISOString() }
          : view
      )
    );
  }, []);

  // Delete view
  const deleteView = useCallback(async (id: string): Promise<void> => {
    setCustomViews(prev => prev.filter(view => view.id !== id));

    // Also remove from favorites
    setFavoriteViewIds(prev => prev.filter(fid => fid !== id));

    // Clear active view if deleted
    if (activeViewId === id) {
      setActiveViewId(null);
    }
  }, [activeViewId]);

  // Toggle favorite
  const toggleFavorite = useCallback((viewId: string) => {
    setFavoriteViewIds(prev =>
      prev.includes(viewId)
        ? prev.filter(id => id !== viewId)
        : [...prev, viewId]
    );
  }, []);

  return {
    views: viewsWithCounts,
    activeView,
    activeViewId,
    setActiveViewId,
    createView,
    updateView,
    deleteView,
    favoriteViewIds,
    toggleFavorite,
    refreshCounts,
    loading,
  };
};
```

---

## 6. URL Sync with Views

```typescript
// File: src/hooks/useViewUrlSync.ts

import { useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { FilterState, SavedView } from '../types/views';

interface UseViewUrlSyncResult {
  activeViewId: string | null;
  filters: FilterState;
  setFiltersFromUrl: (filters: FilterState) => void;
  setViewFromUrl: (viewId: string | null) => void;
}

// Convert filters to URL params
const filtersToParams = (filters: FilterState): URLSearchParams => {
  const params = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    if (value === undefined || value === null) return;

    if (Array.isArray(value)) {
      if (value.length > 0) {
        params.set(key, value.join(','));
      }
    } else if (typeof value === 'object') {
      // Handle range objects like slaDaysRemaining: { min: 0, max: 3 }
      Object.entries(value).forEach(([subKey, subValue]) => {
        if (subValue !== undefined) {
          params.set(`${key}.${subKey}`, String(subValue));
        }
      });
    } else if (typeof value === 'boolean') {
      params.set(key, value ? '1' : '0');
    } else {
      params.set(key, String(value));
    }
  });

  return params;
};

// Parse URL params to filters
const paramsToFilters = (params: URLSearchParams): FilterState => {
  const filters: FilterState = {};

  // Array fields
  const arrayFields = ['severity', 'status', 'productId', 'category', 'sourceType', 'policyDecision', 'riskBand'];

  params.forEach((value, key) => {
    // Handle range fields (e.g., slaDaysRemaining.min)
    if (key.includes('.')) {
      const [parentKey, subKey] = key.split('.');
      if (!filters[parentKey as keyof FilterState]) {
        (filters as any)[parentKey] = {};
      }
      (filters as any)[parentKey][subKey] = isNaN(Number(value)) ? value : Number(value);
      return;
    }

    // Handle array fields
    if (arrayFields.includes(key)) {
      (filters as any)[key] = value.split(',');
      return;
    }

    // Handle boolean fields
    if (key === 'slaBreached' || key === 'kev') {
      (filters as any)[key] = value === '1' || value === 'true';
      return;
    }

    // Handle number fields
    if (key.includes('Min') || key.includes('Max') || key === 'riskScoreMin' || key === 'riskScoreMax') {
      (filters as any)[key] = Number(value);
      return;
    }

    // Default string handling
    (filters as any)[key] = value;
  });

  return filters;
};

export const useViewUrlSync = (
  views: SavedView[]
): UseViewUrlSyncResult => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  // Get active view ID from URL
  const activeViewId = useMemo(() => {
    return searchParams.get('view') || null;
  }, [searchParams]);

  // Get filters from URL
  const filters = useMemo(() => {
    const viewId = searchParams.get('view');

    // If view is specified, use its filters
    if (viewId) {
      const view = views.find(v => v.id === viewId);
      if (view) {
        return view.filters;
      }
    }

    // Otherwise parse from URL params
    const params = new URLSearchParams(searchParams);
    params.delete('view');
    return paramsToFilters(params);
  }, [searchParams, views]);

  // Set filters in URL
  const setFiltersFromUrl = (newFilters: FilterState) => {
    const params = filtersToParams(newFilters);
    // Clear view param when setting custom filters
    params.delete('view');
    setSearchParams(params);
  };

  // Set view in URL
  const setViewFromUrl = (viewId: string | null) => {
    if (viewId) {
      setSearchParams({ view: viewId });
    } else {
      setSearchParams({});
    }
  };

  return {
    activeViewId,
    filters,
    setFiltersFromUrl,
    setViewFromUrl,
  };
};
```

---

## 7. Integration Example

```tsx
// File: src/pages/FindingsList.tsx (updated section)

import { SmartViewsBar } from '../components/findings/SmartViewsBar';
import { useSavedViews } from '../hooks/useSavedViews';
import { useViewUrlSync } from '../hooks/useViewUrlSync';

export const FindingsList: React.FC = () => {
  const {
    views,
    activeView,
    activeViewId,
    setActiveViewId,
    createView,
    updateView,
    deleteView,
    favoriteViewIds,
    toggleFavorite,
  } = useSavedViews();

  const { filters, setFiltersFromUrl, setViewFromUrl } = useViewUrlSync(views);

  // Sync URL with active view
  const handleViewChange = (viewId: string | null) => {
    setActiveViewId(viewId);
    setViewFromUrl(viewId);
  };

  // When filters change directly (not via view)
  const handleFiltersChange = (newFilters: FilterState) => {
    setActiveViewId(null);  // Clear active view
    setFiltersFromUrl(newFilters);
  };

  return (
    <Box>
      <SmartViewsBar
        views={views}
        activeViewId={activeViewId}
        onViewChange={handleViewChange}
        onCreateView={createView}
        onUpdateView={updateView}
        onDeleteView={deleteView}
        currentFilters={filters}
        favoriteViewIds={favoriteViewIds}
        onToggleFavorite={toggleFavorite}
      />

      {/* Rest of findings list */}
      <FindingsTable
        filters={filters}
        onFiltersChange={handleFiltersChange}
        // ...
      />
    </Box>
  );
};
```

---

## 8. API Requirements

For full functionality, backend needs to support:

```typescript
// Endpoint: GET /api/v1/findings/count
// Returns count only (no data) for performance

interface CountRequest {
  filters: FilterState;
}

interface CountResponse {
  count: number;
}

// This is more efficient than fetching all data with limit=0
// Implementation: SELECT COUNT(*) FROM findings WHERE ...
```

---

## Summary

This specification provides:

1. **23 System Views** organized by category (Triage, Priority, SLA, Intel, Category, Status, Time)
2. **SmartViewsBar Component** with quick access tabs and expandable category view
3. **useSavedViews Hook** for managing custom views with localStorage persistence
4. **useViewUrlSync Hook** for URL synchronization
5. **Type definitions** for filters and views

Key Features:
- Favorites system for quick access
- Real-time count badges
- Context menu for view management
- URL synchronization for shareable links
- Support for both system and custom views

---

*Version: 1.0*
*Created: 2026-01-25*
