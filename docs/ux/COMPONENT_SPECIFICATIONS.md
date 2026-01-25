# Component Specifications for Triage Dashboard

## Overview

Данный документ содержит детальные спецификации React-компонентов для реализации Triage Dashboard UX. Все компоненты используют существующие API контракты из `backend/internal/dto/v1/`.

---

## 1. Dashboard Components

### 1.1 MetricCard

**Purpose**: Отображение KPI с трендом и возможностью клика для перехода к отфильтрованному списку.

```tsx
// File: src/components/dashboard/MetricCard.tsx

import React from 'react';
import { Card, CardContent, Typography, Box, Skeleton } from '@mui/material';
import { TrendingUp, TrendingDown, TrendingFlat } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

interface MetricCardProps {
  title: string;
  value: number;
  trend?: {
    direction: 'up' | 'down' | 'neutral';
    percentage: number;
    label?: string;  // "vs last week"
  };
  icon: React.ReactNode;
  color?: 'default' | 'success' | 'warning' | 'error' | 'info';
  navigateTo?: string;  // URL with filters
  loading?: boolean;
  subtitle?: string;
}

const colorMap = {
  default: '#90caf9',
  success: '#66bb6a',
  warning: '#ffa726',
  error: '#f44336',
  info: '#29b6f6',
};

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  trend,
  icon,
  color = 'default',
  navigateTo,
  loading = false,
  subtitle
}) => {
  const navigate = useNavigate();

  const handleClick = () => {
    if (navigateTo) {
      navigate(navigateTo);
    }
  };

  const TrendIcon = trend?.direction === 'up'
    ? TrendingUp
    : trend?.direction === 'down'
      ? TrendingDown
      : TrendingFlat;

  const trendColor = trend?.direction === 'up'
    ? (color === 'error' ? '#f44336' : '#66bb6a')  // Up is bad for errors
    : trend?.direction === 'down'
      ? (color === 'error' ? '#66bb6a' : '#f44336') // Down is good for errors
      : '#9e9e9e';

  if (loading) {
    return (
      <Card sx={{ height: 140 }}>
        <CardContent>
          <Skeleton variant="text" width="60%" />
          <Skeleton variant="text" width="40%" height={48} />
          <Skeleton variant="text" width="80%" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      sx={{
        height: 140,
        cursor: navigateTo ? 'pointer' : 'default',
        transition: 'transform 0.2s, box-shadow 0.2s',
        '&:hover': navigateTo ? {
          transform: 'translateY(-2px)',
          boxShadow: 4,
        } : {},
        borderLeft: `4px solid ${colorMap[color]}`,
      }}
      onClick={handleClick}
    >
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="flex-start">
          <Box>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              {title}
            </Typography>
            <Typography variant="h3" component="div" fontWeight="bold">
              {value.toLocaleString()}
            </Typography>
            {subtitle && (
              <Typography variant="caption" color="text.secondary">
                {subtitle}
              </Typography>
            )}
          </Box>
          <Box
            sx={{
              backgroundColor: `${colorMap[color]}20`,
              borderRadius: 2,
              p: 1,
            }}
          >
            {React.cloneElement(icon as React.ReactElement, {
              sx: { color: colorMap[color], fontSize: 28 }
            })}
          </Box>
        </Box>

        {trend && (
          <Box display="flex" alignItems="center" mt={1}>
            <TrendIcon sx={{ color: trendColor, fontSize: 18, mr: 0.5 }} />
            <Typography variant="body2" sx={{ color: trendColor }}>
              {trend.percentage}%
            </Typography>
            {trend.label && (
              <Typography variant="caption" color="text.secondary" ml={1}>
                {trend.label}
              </Typography>
            )}
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

// Usage Example:
// <MetricCard
//   title="Critical & High"
//   value={89}
//   trend={{ direction: 'down', percentage: 5, label: 'vs last week' }}
//   icon={<WarningIcon />}
//   color="error"
//   navigateTo="/findings?severity=critical,high&status=new,under_review,confirmed"
// />
```

### 1.2 AlertsPanel

**Purpose**: Панель с критическими алертами, требующими внимания.

```tsx
// File: src/components/dashboard/AlertsPanel.tsx

import React from 'react';
import { Paper, Box, Typography, Chip, IconButton, Tooltip } from '@mui/material';
import {
  Alarm as AlarmIcon,
  Security as SecurityIcon,
  TrendingUp as TrendingUpIcon,
  Policy as PolicyIcon,
  ArrowForward as ArrowForwardIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

interface AlertItem {
  id: string;
  type: 'sla_breach' | 'kev_active' | 'new_critical' | 'policy_fail';
  count: number;
  severity: 'critical' | 'high' | 'medium';
}

interface AlertsPanelProps {
  alerts: AlertItem[];
  loading?: boolean;
}

const alertConfig = {
  sla_breach: {
    icon: AlarmIcon,
    color: '#f44336',
    bgColor: '#f4433610',
    title: 'SLA Breached',
    description: 'Findings past their SLA deadline',
    navigateTo: '/findings?slaBreached=true&status=new,under_review,confirmed',
  },
  kev_active: {
    icon: SecurityIcon,
    color: '#ff9800',
    bgColor: '#ff980010',
    title: 'KEV Active',
    description: 'Known exploited vulnerabilities',
    navigateTo: '/findings?kev=true&status=new,under_review,confirmed',
  },
  new_critical: {
    icon: TrendingUpIcon,
    color: '#f44336',
    bgColor: '#f4433610',
    title: 'New Critical Today',
    description: 'Critical findings discovered today',
    navigateTo: '/findings?severity=critical&dateFrom=today',
  },
  policy_fail: {
    icon: PolicyIcon,
    color: '#ff5722',
    bgColor: '#ff572210',
    title: 'Policy Failed',
    description: 'Import jobs that failed policy gate',
    navigateTo: '/import-jobs?gateFailed=true',
  },
};

export const AlertsPanel: React.FC<AlertsPanelProps> = ({ alerts, loading }) => {
  const navigate = useNavigate();

  const visibleAlerts = alerts.filter(a => a.count > 0);

  if (loading) {
    return (
      <Paper sx={{ p: 3 }}>
        <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
          Alerts & Attention Needed
        </Typography>
        <Box display="flex" gap={2}>
          {[1, 2, 3].map(i => (
            <Box key={i} sx={{ flex: 1, height: 80, bgcolor: 'action.hover', borderRadius: 1 }} />
          ))}
        </Box>
      </Paper>
    );
  }

  if (visibleAlerts.length === 0) {
    return (
      <Paper sx={{ p: 3, bgcolor: '#66bb6a10', border: '1px solid #66bb6a30' }}>
        <Typography variant="subtitle1" fontWeight="bold" color="success.main">
          All Clear - No Urgent Alerts
        </Typography>
      </Paper>
    );
  }

  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
        Alerts & Attention Needed
      </Typography>

      <Box display="flex" gap={2} flexWrap="wrap">
        {visibleAlerts.map(alert => {
          const config = alertConfig[alert.type];
          const Icon = config.icon;

          return (
            <Box
              key={alert.id}
              sx={{
                flex: '1 1 200px',
                minWidth: 200,
                p: 2,
                borderRadius: 2,
                bgcolor: config.bgColor,
                border: `1px solid ${config.color}30`,
                cursor: 'pointer',
                transition: 'all 0.2s',
                '&:hover': {
                  bgcolor: `${config.color}15`,
                  transform: 'translateY(-2px)',
                },
              }}
              onClick={() => navigate(config.navigateTo)}
            >
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box display="flex" alignItems="center" gap={1}>
                  <Icon sx={{ color: config.color }} />
                  <Typography variant="h5" fontWeight="bold" sx={{ color: config.color }}>
                    {alert.count}
                  </Typography>
                </Box>
                <Tooltip title="View All">
                  <IconButton size="small">
                    <ArrowForwardIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
              <Typography variant="subtitle2" fontWeight="medium" mt={1}>
                {config.title}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {config.description}
              </Typography>
            </Box>
          );
        })}
      </Box>
    </Paper>
  );
};
```

### 1.3 SeverityDonutChart

**Purpose**: Визуализация распределения findings по severity.

```tsx
// File: src/components/dashboard/SeverityDonutChart.tsx

import React from 'react';
import { Paper, Box, Typography, Stack } from '@mui/material';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

interface SeverityData {
  name: string;
  value: number;
  color: string;
}

interface SeverityDonutChartProps {
  data: SeverityData[];
  loading?: boolean;
  title?: string;
  onSegmentClick?: (severity: string) => void;
}

const SEVERITY_COLORS = {
  Critical: '#d32f2f',
  High: '#f57c00',
  Medium: '#fbc02d',
  Low: '#388e3c',
};

export const SeverityDonutChart: React.FC<SeverityDonutChartProps> = ({
  data,
  loading = false,
  title = 'Severity Distribution',
  onSegmentClick,
}) => {
  const total = data.reduce((sum, item) => sum + item.value, 0);

  const handleClick = (entry: SeverityData) => {
    if (onSegmentClick) {
      onSegmentClick(entry.name.toLowerCase());
    }
  };

  return (
    <Paper sx={{ p: 3, height: '100%' }}>
      <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
        {title}
      </Typography>

      <Box sx={{ width: '100%', height: 250 }}>
        <ResponsiveContainer>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={90}
              paddingAngle={2}
              dataKey="value"
              onClick={(_, index) => handleClick(data[index])}
              style={{ cursor: onSegmentClick ? 'pointer' : 'default' }}
            >
              {data.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.color}
                  stroke="none"
                />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number, name: string) => [
                `${value} (${((value / total) * 100).toFixed(1)}%)`,
                name
              ]}
            />
          </PieChart>
        </ResponsiveContainer>
      </Box>

      {/* Center total */}
      <Box
        sx={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          textAlign: 'center',
          pointerEvents: 'none',
        }}
      >
        <Typography variant="h4" fontWeight="bold">
          {total}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Total
        </Typography>
      </Box>

      {/* Legend */}
      <Stack direction="row" spacing={2} justifyContent="center" mt={2}>
        {data.map(item => (
          <Box key={item.name} display="flex" alignItems="center" gap={0.5}>
            <Box
              sx={{
                width: 12,
                height: 12,
                borderRadius: '50%',
                bgcolor: item.color
              }}
            />
            <Typography variant="caption">
              {item.name}: {item.value}
            </Typography>
          </Box>
        ))}
      </Stack>
    </Paper>
  );
};

// Usage:
// <SeverityDonutChart
//   data={[
//     { name: 'Critical', value: 12, color: SEVERITY_COLORS.Critical },
//     { name: 'High', value: 77, color: SEVERITY_COLORS.High },
//     { name: 'Medium', value: 98, color: SEVERITY_COLORS.Medium },
//     { name: 'Low', value: 60, color: SEVERITY_COLORS.Low },
//   ]}
//   onSegmentClick={(severity) => navigate(`/findings?severity=${severity}`)}
// />
```

### 1.4 TrendLineChart

**Purpose**: Отображение трендов findings за 30 дней.

```tsx
// File: src/components/dashboard/TrendLineChart.tsx

import React from 'react';
import { Paper, Box, Typography, ToggleButtonGroup, ToggleButton } from '@mui/material';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend
} from 'recharts';

interface TrendPoint {
  date: string;
  dateFormatted: string;  // "Jan 15"
  newCount: number;
  fixedCount: number;
  openCount: number;
}

interface TrendLineChartProps {
  data: TrendPoint[];
  loading?: boolean;
  title?: string;
  period?: '7d' | '30d' | '90d';
  onPeriodChange?: (period: '7d' | '30d' | '90d') => void;
}

const COLORS = {
  new: '#f44336',      // Red
  fixed: '#4caf50',    // Green
  open: '#2196f3',     // Blue
};

export const TrendLineChart: React.FC<TrendLineChartProps> = ({
  data,
  loading = false,
  title = 'Findings Trend',
  period = '30d',
  onPeriodChange,
}) => {
  return (
    <Paper sx={{ p: 3, height: '100%' }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="subtitle1" fontWeight="bold">
          {title}
        </Typography>

        {onPeriodChange && (
          <ToggleButtonGroup
            size="small"
            value={period}
            exclusive
            onChange={(_, newPeriod) => newPeriod && onPeriodChange(newPeriod)}
          >
            <ToggleButton value="7d">7D</ToggleButton>
            <ToggleButton value="30d">30D</ToggleButton>
            <ToggleButton value="90d">90D</ToggleButton>
          </ToggleButtonGroup>
        )}
      </Box>

      <Box sx={{ width: '100%', height: 250 }}>
        <ResponsiveContainer>
          <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
            <XAxis
              dataKey="dateFormatted"
              stroke="#888"
              tick={{ fontSize: 12 }}
              interval="preserveStartEnd"
            />
            <YAxis
              stroke="#888"
              tick={{ fontSize: 12 }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1e1e1e',
                border: '1px solid #333',
                borderRadius: 4,
              }}
              labelStyle={{ color: '#fff' }}
            />
            <Legend />

            <Line
              type="monotone"
              dataKey="newCount"
              name="New"
              stroke={COLORS.new}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
            <Line
              type="monotone"
              dataKey="fixedCount"
              name="Fixed"
              stroke={COLORS.fixed}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
            <Line
              type="monotone"
              dataKey="openCount"
              name="Open Total"
              stroke={COLORS.open}
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={false}
              activeDot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </Box>
    </Paper>
  );
};
```

---

## 2. Finding Detail Components

### 2.1 QuickActionsBar

**Purpose**: Панель быстрых действий для finding.

```tsx
// File: src/components/findings/QuickActionsBar.tsx

import React, { useState } from 'react';
import {
  Box, Button, ButtonGroup, Menu, MenuItem,
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Tooltip, Divider
} from '@mui/material';
import {
  Check as CheckIcon,
  Close as CloseIcon,
  Warning as WarningIcon,
  Person as PersonIcon,
  BugReport as TicketIcon,
  Link as LinkIcon,
  Comment as CommentIcon,
  MoreVert as MoreIcon,
} from '@mui/icons-material';
import { Finding, FindingStatus, User } from '../../types/findings';

interface QuickActionsBarProps {
  finding: Finding;
  users: User[];
  onStatusChange: (status: FindingStatus, reason?: string) => Promise<void>;
  onAssign: (userId: string) => Promise<void>;
  onCreateTicket: () => Promise<void>;
  onAddComment: (body: string) => Promise<void>;
  onCopyLink: () => void;
  loading?: boolean;
}

export const QuickActionsBar: React.FC<QuickActionsBarProps> = ({
  finding,
  users,
  onStatusChange,
  onAssign,
  onCreateTicket,
  onAddComment,
  onCopyLink,
  loading = false,
}) => {
  const [assignMenuAnchor, setAssignMenuAnchor] = useState<null | HTMLElement>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    status?: FindingStatus;
    title?: string;
    requireReason?: boolean;
  }>({ open: false });
  const [reason, setReason] = useState('');
  const [commentDialog, setCommentDialog] = useState(false);
  const [comment, setComment] = useState('');

  const handleStatusAction = async (status: FindingStatus, requireReason = false) => {
    if (requireReason) {
      setConfirmDialog({
        open: true,
        status,
        title: `Mark as ${status.replace('_', ' ')}`,
        requireReason: true,
      });
    } else {
      await onStatusChange(status);
    }
  };

  const handleConfirmDialog = async () => {
    if (confirmDialog.status) {
      await onStatusChange(confirmDialog.status, reason);
    }
    setConfirmDialog({ open: false });
    setReason('');
  };

  const handleAssign = async (userId: string) => {
    await onAssign(userId);
    setAssignMenuAnchor(null);
  };

  const handleAddComment = async () => {
    await onAddComment(comment);
    setCommentDialog(false);
    setComment('');
  };

  return (
    <>
      <Box
        sx={{
          p: 2,
          bgcolor: 'background.paper',
          borderRadius: 1,
          border: '1px solid',
          borderColor: 'divider',
        }}
      >
        {/* Primary Actions */}
        <Box display="flex" gap={1} flexWrap="wrap">
          <ButtonGroup variant="contained" size="small" disabled={loading}>
            <Tooltip title="Confirm finding (c)">
              <Button
                color="primary"
                startIcon={<CheckIcon />}
                onClick={() => handleStatusAction('confirmed')}
              >
                Confirm
              </Button>
            </Tooltip>
            <Tooltip title="Mark as false positive (f)">
              <Button
                color="inherit"
                startIcon={<CloseIcon />}
                onClick={() => handleStatusAction('false_positive', true)}
              >
                False Positive
              </Button>
            </Tooltip>
            <Tooltip title="Accept risk (r)">
              <Button
                color="warning"
                startIcon={<WarningIcon />}
                onClick={() => handleStatusAction('risk_accepted', true)}
              >
                Accept Risk
              </Button>
            </Tooltip>
          </ButtonGroup>

          <Tooltip title="Assign to user (a)">
            <Button
              variant="outlined"
              size="small"
              startIcon={<PersonIcon />}
              onClick={(e) => setAssignMenuAnchor(e.currentTarget)}
              disabled={loading}
            >
              Assign
            </Button>
          </Tooltip>
        </Box>

        <Divider sx={{ my: 1.5 }} />

        {/* Secondary Actions */}
        <Box display="flex" gap={1}>
          <Tooltip title="Create JIRA ticket (t)">
            <Button
              size="small"
              startIcon={<TicketIcon />}
              onClick={onCreateTicket}
              disabled={loading}
            >
              Create Ticket
            </Button>
          </Tooltip>
          <Tooltip title="Copy link to finding">
            <Button
              size="small"
              startIcon={<LinkIcon />}
              onClick={onCopyLink}
            >
              Copy Link
            </Button>
          </Tooltip>
          <Tooltip title="Add comment (m)">
            <Button
              size="small"
              startIcon={<CommentIcon />}
              onClick={() => setCommentDialog(true)}
              disabled={loading}
            >
              Comment
            </Button>
          </Tooltip>
        </Box>
      </Box>

      {/* Assign Menu */}
      <Menu
        anchorEl={assignMenuAnchor}
        open={Boolean(assignMenuAnchor)}
        onClose={() => setAssignMenuAnchor(null)}
      >
        {users.map(user => (
          <MenuItem
            key={user.id}
            onClick={() => handleAssign(user.id)}
            selected={finding.assigneeId === user.id}
          >
            {user.name}
          </MenuItem>
        ))}
      </Menu>

      {/* Confirmation Dialog */}
      <Dialog
        open={confirmDialog.open}
        onClose={() => setConfirmDialog({ open: false })}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>{confirmDialog.title}</DialogTitle>
        <DialogContent>
          {confirmDialog.requireReason && (
            <TextField
              autoFocus
              margin="dense"
              label="Reason (required)"
              fullWidth
              multiline
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain why this finding is being marked this way..."
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDialog({ open: false })}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirmDialog}
            variant="contained"
            disabled={confirmDialog.requireReason && !reason.trim()}
          >
            Confirm
          </Button>
        </DialogActions>
      </Dialog>

      {/* Comment Dialog */}
      <Dialog
        open={commentDialog}
        onClose={() => setCommentDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Add Comment</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Comment"
            fullWidth
            multiline
            rows={4}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Add your analysis, notes, or questions..."
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCommentDialog(false)}>Cancel</Button>
          <Button
            onClick={handleAddComment}
            variant="contained"
            disabled={!comment.trim()}
          >
            Add Comment
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};
```

### 2.2 EvidenceTab

**Purpose**: Отображение code evidence с подсветкой синтаксиса.

```tsx
// File: src/components/findings/tabs/EvidenceTab.tsx

import React from 'react';
import {
  Box, Typography, Paper, Chip, Link, IconButton,
  Tooltip, Stack, Divider
} from '@mui/material';
import {
  ContentCopy as CopyIcon,
  OpenInNew as OpenInNewIcon,
  Code as CodeIcon,
  Fullscreen as ExpandIcon,
} from '@mui/icons-material';
import Prism from 'prismjs';
import 'prismjs/themes/prism-tomorrow.css';
import 'prismjs/components/prism-go';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-typescript';

interface EvidenceTabProps {
  finding: {
    details?: {
      filePath?: string;
      startLine?: number;
      endLine?: number;
      snippet?: string;
      message?: string;
      ruleId?: string;
      cwe?: string[];
      owasp?: string[];
    };
    sourceType?: string;
    sourceVersion?: string;
    remediation?: {
      guidance?: string;
      codeExample?: string;
      references?: string[];
    };
  };
  onOpenInEditor?: (path: string, line: number) => void;
}

const getLanguage = (filePath?: string): string => {
  if (!filePath) return 'text';
  const ext = filePath.split('.').pop()?.toLowerCase();
  const langMap: Record<string, string> = {
    go: 'go',
    py: 'python',
    js: 'javascript',
    ts: 'typescript',
    tsx: 'typescript',
    jsx: 'javascript',
    java: 'java',
    rb: 'ruby',
    rs: 'rust',
  };
  return langMap[ext || ''] || 'text';
};

export const EvidenceTab: React.FC<EvidenceTabProps> = ({
  finding,
  onOpenInEditor
}) => {
  const { details, sourceType, sourceVersion, remediation } = finding;
  const language = getLanguage(details?.filePath);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    // TODO: Show toast notification
  };

  const renderCodeBlock = (code: string, startLine = 1, highlightLine?: number) => {
    const html = Prism.highlight(code, Prism.languages[language] || Prism.languages.text, language);
    const lines = html.split('\n');

    return (
      <Box
        sx={{
          bgcolor: '#1e1e1e',
          borderRadius: 1,
          overflow: 'auto',
          fontFamily: 'monospace',
          fontSize: 13,
          lineHeight: 1.5,
        }}
      >
        <Box sx={{ display: 'table', width: '100%' }}>
          {lines.map((line, index) => {
            const lineNum = startLine + index;
            const isHighlighted = lineNum === highlightLine;

            return (
              <Box
                key={index}
                sx={{
                  display: 'table-row',
                  bgcolor: isHighlighted ? 'rgba(255, 235, 59, 0.15)' : 'transparent',
                  '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.05)' },
                }}
              >
                <Box
                  component="span"
                  sx={{
                    display: 'table-cell',
                    width: 50,
                    textAlign: 'right',
                    pr: 2,
                    pl: 1,
                    color: 'text.disabled',
                    userSelect: 'none',
                    borderRight: '1px solid #333',
                  }}
                >
                  {isHighlighted && '> '}
                  {lineNum}
                </Box>
                <Box
                  component="span"
                  sx={{
                    display: 'table-cell',
                    pl: 2,
                    pr: 2,
                    py: 0.25,
                    whiteSpace: 'pre',
                  }}
                  dangerouslySetInnerHTML={{ __html: line || '&nbsp;' }}
                />
              </Box>
            );
          })}
        </Box>
      </Box>
    );
  };

  return (
    <Box>
      {/* Location Section */}
      {details?.filePath && (
        <Paper sx={{ p: 2, mb: 3 }}>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            Location
          </Typography>
          <Box display="flex" alignItems="center" gap={1} flexWrap="wrap">
            <CodeIcon fontSize="small" color="action" />
            <Typography variant="body2" fontFamily="monospace">
              {details.filePath}
              {details.startLine && `:${details.startLine}`}
              {details.endLine && details.endLine !== details.startLine && `-${details.endLine}`}
            </Typography>
            <Box flexGrow={1} />
            <Tooltip title="Copy path">
              <IconButton size="small" onClick={() => handleCopy(details.filePath!)}>
                <CopyIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            {onOpenInEditor && (
              <Tooltip title="Open in VS Code">
                <IconButton
                  size="small"
                  onClick={() => onOpenInEditor(details.filePath!, details.startLine || 1)}
                >
                  <OpenInNewIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
          </Box>
        </Paper>
      )}

      {/* Code Snippet Section */}
      {details?.snippet && (
        <Paper sx={{ p: 2, mb: 3 }}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
            <Typography variant="subtitle2" color="text.secondary">
              Code Snippet
            </Typography>
            <Stack direction="row" spacing={1}>
              <Chip label={language} size="small" variant="outlined" />
              <Tooltip title="Copy code">
                <IconButton size="small" onClick={() => handleCopy(details.snippet!)}>
                  <CopyIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Stack>
          </Box>
          {renderCodeBlock(details.snippet, details.startLine || 1, details.startLine)}
        </Paper>
      )}

      {/* Detection Info */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          Detection Info
        </Typography>

        <Stack spacing={1}>
          <Box display="flex" gap={1}>
            <Typography variant="body2" color="text.secondary" minWidth={100}>
              Scanner:
            </Typography>
            <Typography variant="body2">
              {sourceType} {sourceVersion && `v${sourceVersion}`}
            </Typography>
          </Box>

          {details?.ruleId && (
            <Box display="flex" gap={1}>
              <Typography variant="body2" color="text.secondary" minWidth={100}>
                Rule:
              </Typography>
              <Typography variant="body2" fontFamily="monospace">
                {details.ruleId}
              </Typography>
            </Box>
          )}

          {details?.message && (
            <Box display="flex" gap={1}>
              <Typography variant="body2" color="text.secondary" minWidth={100}>
                Message:
              </Typography>
              <Typography variant="body2">{details.message}</Typography>
            </Box>
          )}
        </Stack>

        {/* Classification Tags */}
        {(details?.cwe?.length || details?.owasp?.length) && (
          <>
            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Classification
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {details?.cwe?.map(cwe => (
                <Chip
                  key={cwe}
                  label={cwe}
                  size="small"
                  component="a"
                  href={`https://cwe.mitre.org/data/definitions/${cwe.replace('CWE-', '')}.html`}
                  target="_blank"
                  clickable
                />
              ))}
              {details?.owasp?.map(owasp => (
                <Chip
                  key={owasp}
                  label={owasp}
                  size="small"
                  color="primary"
                  variant="outlined"
                />
              ))}
            </Stack>
          </>
        )}
      </Paper>

      {/* Remediation Guidance */}
      {remediation && (
        <Paper sx={{ p: 2 }}>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            How to Fix
          </Typography>

          {remediation.guidance && (
            <Typography variant="body2" paragraph>
              {remediation.guidance}
            </Typography>
          )}

          {remediation.codeExample && (
            <Box mt={2}>
              <Typography variant="caption" color="text.secondary">
                Remediation Example:
              </Typography>
              {renderCodeBlock(remediation.codeExample)}
            </Box>
          )}

          {remediation.references?.length > 0 && (
            <Box mt={2}>
              <Typography variant="caption" color="text.secondary" display="block" mb={1}>
                References:
              </Typography>
              {remediation.references.map((ref, i) => (
                <Link
                  key={i}
                  href={ref}
                  target="_blank"
                  display="block"
                  variant="body2"
                  sx={{ mb: 0.5 }}
                >
                  {ref}
                </Link>
              ))}
            </Box>
          )}
        </Paper>
      )}
    </Box>
  );
};
```

### 2.3 IntelligenceTab

**Purpose**: Отображение intelligence данных (CVE, EPSS, KEV, Risk Score).

```tsx
// File: src/components/findings/tabs/IntelligenceTab.tsx

import React from 'react';
import {
  Box, Typography, Paper, Grid, Chip, LinearProgress,
  Tooltip, Link, Stack, Divider
} from '@mui/material';
import {
  Security as SecurityIcon,
  Warning as WarningIcon,
  TrendingUp as TrendingUpIcon,
  Info as InfoIcon,
} from '@mui/icons-material';

interface IntelligenceTabProps {
  finding: {
    intel_summary?: {
      identifiers: string[];
      cvss?: { score: number; version: string };
      epss?: { score: number; percentile: number };
      kev: boolean;
      last_refreshed_at?: string;
    };
    riskScore?: number;
    riskBand?: string;
    riskFactors?: {
      impact?: { value?: number; cvss_score?: number; severity?: string };
      likelihood?: { epss_score?: number; kev?: boolean; value?: number };
      asset?: { criticality?: string; multiplier?: number; internet_exposed?: boolean };
      freshness?: { age_days?: number; multiplier?: number };
    };
    modelVersion?: string;
    riskUpdatedAt?: string;
    scaDetails?: {
      pkgName?: string;
      installedVersion?: string;
      fixedVersion?: string;
      ecosystem?: string;
      purl?: string;
    };
  };
}

const getCvssColor = (score: number): string => {
  if (score >= 9) return '#d32f2f';
  if (score >= 7) return '#f57c00';
  if (score >= 4) return '#fbc02d';
  return '#388e3c';
};

const getCvssSeverity = (score: number): string => {
  if (score >= 9) return 'CRITICAL';
  if (score >= 7) return 'HIGH';
  if (score >= 4) return 'MEDIUM';
  return 'LOW';
};

export const IntelligenceTab: React.FC<IntelligenceTabProps> = ({ finding }) => {
  const { intel_summary, riskScore, riskFactors, scaDetails, modelVersion, riskUpdatedAt } = finding;

  const RiskMetricCard: React.FC<{
    title: string;
    value: string | number;
    subValue?: string;
    color: string;
    icon: React.ReactNode;
    progress?: number;
  }> = ({ title, value, subValue, color, icon, progress }) => (
    <Paper sx={{ p: 2, textAlign: 'center' }}>
      <Box color={color} mb={1}>{icon}</Box>
      <Typography variant="h4" fontWeight="bold" color={color}>
        {value}
      </Typography>
      {subValue && (
        <Typography variant="caption" color="text.secondary">
          {subValue}
        </Typography>
      )}
      <Typography variant="subtitle2" color="text.secondary" mt={1}>
        {title}
      </Typography>
      {progress !== undefined && (
        <LinearProgress
          variant="determinate"
          value={progress}
          sx={{
            mt: 1,
            height: 6,
            borderRadius: 1,
            bgcolor: `${color}20`,
            '& .MuiLinearProgress-bar': { bgcolor: color }
          }}
        />
      )}
    </Paper>
  );

  return (
    <Box>
      {/* Identifiers */}
      {intel_summary?.identifiers?.length > 0 && (
        <Paper sx={{ p: 2, mb: 3 }}>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            Vulnerability Identifiers
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {intel_summary.identifiers.map(id => {
              const isCve = id.startsWith('CVE-');
              const href = isCve
                ? `https://nvd.nist.gov/vuln/detail/${id}`
                : id.startsWith('GHSA-')
                  ? `https://github.com/advisories/${id}`
                  : undefined;

              return (
                <Chip
                  key={id}
                  label={id}
                  component={href ? 'a' : 'span'}
                  href={href}
                  target="_blank"
                  clickable={!!href}
                  color={isCve ? 'error' : 'default'}
                  variant="outlined"
                />
              );
            })}
          </Stack>
        </Paper>
      )}

      {/* Risk Metrics Cards */}
      <Grid container spacing={2} mb={3}>
        {intel_summary?.cvss && (
          <Grid item xs={12} sm={4}>
            <RiskMetricCard
              title="CVSS Score"
              value={intel_summary.cvss.score.toFixed(1)}
              subValue={getCvssSeverity(intel_summary.cvss.score)}
              color={getCvssColor(intel_summary.cvss.score)}
              icon={<WarningIcon fontSize="large" />}
              progress={intel_summary.cvss.score * 10}
            />
          </Grid>
        )}

        {intel_summary?.epss && (
          <Grid item xs={12} sm={4}>
            <RiskMetricCard
              title="EPSS Score"
              value={(intel_summary.epss.score * 100).toFixed(1) + '%'}
              subValue={`Top ${(100 - intel_summary.epss.percentile).toFixed(0)}%`}
              color={intel_summary.epss.percentile > 90 ? '#f44336' : '#fbc02d'}
              icon={<TrendingUpIcon fontSize="large" />}
              progress={intel_summary.epss.percentile}
            />
          </Grid>
        )}

        <Grid item xs={12} sm={4}>
          <RiskMetricCard
            title="KEV Status"
            value={intel_summary?.kev ? 'YES' : 'NO'}
            subValue={intel_summary?.kev ? 'CISA Listed' : 'Not Listed'}
            color={intel_summary?.kev ? '#f44336' : '#388e3c'}
            icon={<SecurityIcon fontSize="large" />}
          />
        </Grid>
      </Grid>

      {/* Risk Score Breakdown */}
      {riskScore !== undefined && riskFactors && (
        <Paper sx={{ p: 2, mb: 3 }}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="subtitle1" fontWeight="bold">
              Risk Score Breakdown
            </Typography>
            <Chip
              label={`${riskScore}/100`}
              color={riskScore >= 80 ? 'error' : riskScore >= 50 ? 'warning' : 'success'}
              size="small"
            />
          </Box>

          <Box mb={2}>
            <LinearProgress
              variant="determinate"
              value={Math.min(riskScore, 100)}
              sx={{
                height: 12,
                borderRadius: 2,
                bgcolor: '#333',
              }}
            />
          </Box>

          <Stack spacing={2}>
            {riskFactors.impact && (
              <Box>
                <Box display="flex" justifyContent="space-between" mb={0.5}>
                  <Typography variant="body2">
                    Impact (CVSS {riskFactors.impact.cvss_score})
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {((riskFactors.impact.value || 0) * 100).toFixed(0)}%
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={(riskFactors.impact.value || 0) * 100}
                  sx={{ height: 6, borderRadius: 1 }}
                />
              </Box>
            )}

            {riskFactors.likelihood && (
              <Box>
                <Box display="flex" justifyContent="space-between" mb={0.5}>
                  <Typography variant="body2">
                    Exploitability (EPSS {((riskFactors.likelihood.epss_score || 0) * 100).toFixed(1)}%)
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {((riskFactors.likelihood.value || 0) * 100).toFixed(0)}%
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={(riskFactors.likelihood.value || 0) * 100}
                  sx={{ height: 6, borderRadius: 1 }}
                  color="warning"
                />
              </Box>
            )}

            {riskFactors.asset && (
              <Box>
                <Box display="flex" justifyContent="space-between" mb={0.5}>
                  <Typography variant="body2">
                    Asset Criticality ({riskFactors.asset.criticality})
                    {riskFactors.asset.internet_exposed && ' - Internet Exposed'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {riskFactors.asset.multiplier}x
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={Math.min((riskFactors.asset.multiplier || 1) * 50, 100)}
                  sx={{ height: 6, borderRadius: 1 }}
                  color="info"
                />
              </Box>
            )}

            {intel_summary?.kev && (
              <Box display="flex" alignItems="center" gap={1} p={1} bgcolor="error.dark" borderRadius={1}>
                <SecurityIcon color="error" />
                <Typography variant="body2" color="error.light">
                  KEV Multiplier Applied (+25%) - Known Exploited Vulnerability
                </Typography>
              </Box>
            )}
          </Stack>

          <Typography variant="caption" color="text.secondary" display="block" mt={2}>
            Model: {modelVersion || 'lotus-risk-v2.1'} |
            Updated: {riskUpdatedAt ? new Date(riskUpdatedAt).toLocaleString() : 'N/A'}
          </Typography>
        </Paper>
      )}

      {/* Package Information (SCA) */}
      {scaDetails && (
        <Paper sx={{ p: 2 }}>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            Package Information
          </Typography>

          <Stack spacing={1}>
            <Box display="flex" gap={2}>
              <Typography variant="body2" color="text.secondary" minWidth={120}>
                Package:
              </Typography>
              <Typography variant="body2" fontWeight="medium">
                {scaDetails.pkgName}
              </Typography>
            </Box>

            <Box display="flex" gap={2}>
              <Typography variant="body2" color="text.secondary" minWidth={120}>
                Installed:
              </Typography>
              <Typography variant="body2" fontFamily="monospace" color="error.main">
                {scaDetails.installedVersion}
              </Typography>
            </Box>

            {scaDetails.fixedVersion && (
              <Box display="flex" gap={2}>
                <Typography variant="body2" color="text.secondary" minWidth={120}>
                  Fixed In:
                </Typography>
                <Typography variant="body2" fontFamily="monospace" color="success.main">
                  {scaDetails.fixedVersion}
                </Typography>
              </Box>
            )}

            <Box display="flex" gap={2}>
              <Typography variant="body2" color="text.secondary" minWidth={120}>
                Ecosystem:
              </Typography>
              <Chip label={scaDetails.ecosystem} size="small" />
            </Box>

            {scaDetails.purl && (
              <Box display="flex" gap={2}>
                <Typography variant="body2" color="text.secondary" minWidth={120}>
                  PURL:
                </Typography>
                <Typography variant="body2" fontFamily="monospace" fontSize={11}>
                  {scaDetails.purl}
                </Typography>
              </Box>
            )}
          </Stack>

          {scaDetails.fixedVersion && scaDetails.ecosystem && (
            <Box mt={2} p={1.5} bgcolor="action.hover" borderRadius={1}>
              <Typography variant="caption" color="text.secondary" display="block" mb={1}>
                Upgrade Command:
              </Typography>
              <Box
                fontFamily="monospace"
                fontSize={13}
                p={1}
                bgcolor="background.paper"
                borderRadius={1}
              >
                {scaDetails.ecosystem === 'npm' && `npm install ${scaDetails.pkgName}@${scaDetails.fixedVersion}`}
                {scaDetails.ecosystem === 'pypi' && `pip install ${scaDetails.pkgName}==${scaDetails.fixedVersion}`}
                {scaDetails.ecosystem === 'maven' && `Update ${scaDetails.pkgName} to ${scaDetails.fixedVersion} in pom.xml`}
                {scaDetails.ecosystem === 'go' && `go get ${scaDetails.pkgName}@v${scaDetails.fixedVersion}`}
              </Box>
            </Box>
          )}
        </Paper>
      )}
    </Box>
  );
};
```

### 2.4 TimelineTab

**Purpose**: Визуальная timeline событий finding.

```tsx
// File: src/components/findings/tabs/TimelineTab.tsx

import React, { useState } from 'react';
import {
  Box, Typography, Paper, Chip, Stack,
  ToggleButtonGroup, ToggleButton, Avatar,
  Collapse, IconButton, Link
} from '@mui/material';
import {
  Add as AddIcon,
  SwapHoriz as StatusIcon,
  Person as PersonIcon,
  Comment as CommentIcon,
  Alarm as AlarmIcon,
  Repeat as RepeatIcon,
  ExpandMore as ExpandIcon,
} from '@mui/icons-material';
import { formatDistanceToNow, format } from 'date-fns';

type EventType = 'created' | 'status_change' | 'assigned' | 'comment' | 'sla' | 'occurrence';

interface TimelineEvent {
  id: string;
  type: EventType;
  timestamp: string;
  actor?: { id: string; name: string };
  data: {
    from?: string;
    to?: string;
    body?: string;
    occurrenceCount?: number;
    slaStatus?: string;
    importJobId?: string;
  };
}

interface TimelineTabProps {
  events: TimelineEvent[];
  loading?: boolean;
}

const eventConfig: Record<EventType, { icon: React.ElementType; color: string; label: string }> = {
  created: { icon: AddIcon, color: '#2196f3', label: 'Created' },
  status_change: { icon: StatusIcon, color: '#ff9800', label: 'Status Changed' },
  assigned: { icon: PersonIcon, color: '#9c27b0', label: 'Assigned' },
  comment: { icon: CommentIcon, color: '#00bcd4', label: 'Comment' },
  sla: { icon: AlarmIcon, color: '#f44336', label: 'SLA Event' },
  occurrence: { icon: RepeatIcon, color: '#4caf50', label: 'Occurrence' },
};

export const TimelineTab: React.FC<TimelineTabProps> = ({ events, loading }) => {
  const [filter, setFilter] = useState<EventType | 'all'>('all');
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set());

  const filteredEvents = filter === 'all'
    ? events
    : events.filter(e => e.type === filter);

  const groupEventsByDate = (events: TimelineEvent[]) => {
    const groups: Record<string, TimelineEvent[]> = {};

    events.forEach(event => {
      const date = new Date(event.timestamp);
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      let key: string;
      if (date.toDateString() === today.toDateString()) {
        key = 'Today';
      } else if (date.toDateString() === yesterday.toDateString()) {
        key = 'Yesterday';
      } else {
        key = format(date, 'MMMM d, yyyy');
      }

      if (!groups[key]) groups[key] = [];
      groups[key].push(event);
    });

    return groups;
  };

  const toggleComment = (id: string) => {
    const newExpanded = new Set(expandedComments);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedComments(newExpanded);
  };

  const renderEvent = (event: TimelineEvent) => {
    const config = eventConfig[event.type];
    const Icon = config.icon;
    const time = formatDistanceToNow(new Date(event.timestamp), { addSuffix: true });

    return (
      <Box
        key={event.id}
        sx={{
          display: 'flex',
          gap: 2,
          position: 'relative',
          pb: 3,
          '&:last-child': { pb: 0 },
          // Connecting line
          '&::before': {
            content: '""',
            position: 'absolute',
            left: 15,
            top: 32,
            bottom: 0,
            width: 2,
            bgcolor: 'divider',
          },
          '&:last-child::before': { display: 'none' },
        }}
      >
        {/* Icon */}
        <Avatar
          sx={{
            bgcolor: `${config.color}20`,
            color: config.color,
            width: 32,
            height: 32,
            zIndex: 1,
          }}
        >
          <Icon fontSize="small" />
        </Avatar>

        {/* Content */}
        <Box flex={1}>
          <Box display="flex" justifyContent="space-between" alignItems="flex-start">
            <Typography variant="body2">
              {event.type === 'created' && (
                <>
                  Finding Created
                  {event.data.importJobId && (
                    <> from <Link href={`/import-jobs/${event.data.importJobId}`}>Import Job</Link></>
                  )}
                </>
              )}
              {event.type === 'status_change' && (
                <>
                  Status: <Chip label={event.data.from} size="small" sx={{ mx: 0.5 }} />
                  → <Chip label={event.data.to} size="small" color="primary" sx={{ ml: 0.5 }} />
                </>
              )}
              {event.type === 'assigned' && (
                <>Assigned to <strong>{event.data.to}</strong></>
              )}
              {event.type === 'comment' && (
                <Box>
                  <strong>{event.actor?.name}</strong> commented
                  <IconButton
                    size="small"
                    onClick={() => toggleComment(event.id)}
                    sx={{ ml: 1 }}
                  >
                    <ExpandIcon
                      sx={{
                        transform: expandedComments.has(event.id) ? 'rotate(180deg)' : 'none',
                        transition: 'transform 0.2s',
                      }}
                    />
                  </IconButton>
                  <Collapse in={expandedComments.has(event.id)}>
                    <Paper sx={{ p: 1.5, mt: 1, bgcolor: 'action.hover' }}>
                      <Typography variant="body2" whiteSpace="pre-wrap">
                        {event.data.body}
                      </Typography>
                    </Paper>
                  </Collapse>
                </Box>
              )}
              {event.type === 'sla' && (
                <>SLA {event.data.slaStatus}</>
              )}
              {event.type === 'occurrence' && (
                <>Occurrence count updated to <strong>{event.data.occurrenceCount}</strong></>
              )}
            </Typography>
            <Typography variant="caption" color="text.secondary" whiteSpace="nowrap" ml={2}>
              {time}
            </Typography>
          </Box>
          {event.actor && event.type !== 'comment' && (
            <Typography variant="caption" color="text.secondary">
              by {event.actor.name}
            </Typography>
          )}
        </Box>
      </Box>
    );
  };

  const groupedEvents = groupEventsByDate(filteredEvents);

  return (
    <Box>
      {/* Filters */}
      <Paper sx={{ p: 1.5, mb: 3 }}>
        <Typography variant="caption" color="text.secondary" display="block" mb={1}>
          Filter by:
        </Typography>
        <ToggleButtonGroup
          size="small"
          value={filter}
          exclusive
          onChange={(_, newFilter) => newFilter && setFilter(newFilter)}
        >
          <ToggleButton value="all">All</ToggleButton>
          <ToggleButton value="status_change">Status</ToggleButton>
          <ToggleButton value="comment">Comments</ToggleButton>
          <ToggleButton value="assigned">Assignments</ToggleButton>
          <ToggleButton value="sla">SLA</ToggleButton>
        </ToggleButtonGroup>
      </Paper>

      {/* Timeline */}
      {Object.entries(groupedEvents).map(([date, dateEvents]) => (
        <Box key={date} mb={3}>
          <Typography
            variant="overline"
            color="text.secondary"
            display="block"
            mb={2}
            sx={{
              borderBottom: '1px solid',
              borderColor: 'divider',
              pb: 0.5,
            }}
          >
            {date}
          </Typography>
          {dateEvents.map(renderEvent)}
        </Box>
      ))}

      {filteredEvents.length === 0 && (
        <Typography color="text.secondary" textAlign="center" py={4}>
          No events to display
        </Typography>
      )}
    </Box>
  );
};
```

---

## 3. Hooks

### 3.1 useKeyboardShortcuts

**Purpose**: Глобальные клавиатурные сокращения.

```tsx
// File: src/hooks/useKeyboardShortcuts.ts

import { useEffect, useCallback, useMemo } from 'react';

interface Shortcut {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean;  // Cmd on Mac
  action: () => void;
  description?: string;
  scope?: 'global' | 'findings' | 'detail';
}

interface UseKeyboardShortcutsOptions {
  shortcuts: Shortcut[];
  enabled?: boolean;
  scope?: string;
}

export const useKeyboardShortcuts = ({
  shortcuts,
  enabled = true,
  scope = 'global',
}: UseKeyboardShortcutsOptions) => {
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // Don't trigger if typing in input
    if (
      event.target instanceof HTMLInputElement ||
      event.target instanceof HTMLTextAreaElement ||
      (event.target as HTMLElement).isContentEditable
    ) {
      return;
    }

    const matchingShortcut = shortcuts.find(shortcut => {
      const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase();
      const ctrlMatch = !!shortcut.ctrl === (event.ctrlKey || event.metaKey);
      const shiftMatch = !!shortcut.shift === event.shiftKey;
      const altMatch = !!shortcut.alt === event.altKey;
      const scopeMatch = !shortcut.scope || shortcut.scope === scope || shortcut.scope === 'global';

      return keyMatch && ctrlMatch && shiftMatch && altMatch && scopeMatch;
    });

    if (matchingShortcut) {
      event.preventDefault();
      matchingShortcut.action();
    }
  }, [shortcuts, scope]);

  useEffect(() => {
    if (enabled) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [enabled, handleKeyDown]);

  return { shortcuts };
};

// Predefined shortcuts for findings
export const useFindingShortcuts = ({
  onConfirm,
  onFalsePositive,
  onAcceptRisk,
  onAssign,
  onComment,
  onNext,
  onPrev,
  onClose,
}: {
  onConfirm?: () => void;
  onFalsePositive?: () => void;
  onAcceptRisk?: () => void;
  onAssign?: () => void;
  onComment?: () => void;
  onNext?: () => void;
  onPrev?: () => void;
  onClose?: () => void;
}) => {
  const shortcuts = useMemo(() => [
    { key: 'c', action: onConfirm, description: 'Confirm finding', scope: 'detail' as const },
    { key: 'f', action: onFalsePositive, description: 'Mark as false positive', scope: 'detail' as const },
    { key: 'r', action: onAcceptRisk, description: 'Accept risk', scope: 'detail' as const },
    { key: 'a', action: onAssign, description: 'Assign', scope: 'detail' as const },
    { key: 'm', action: onComment, description: 'Add comment', scope: 'detail' as const },
    { key: 'j', action: onNext, description: 'Next finding', scope: 'detail' as const },
    { key: 'k', action: onPrev, description: 'Previous finding', scope: 'detail' as const },
    { key: 'Escape', action: onClose, description: 'Close detail', scope: 'detail' as const },
  ].filter(s => s.action) as Shortcut[], [
    onConfirm, onFalsePositive, onAcceptRisk, onAssign,
    onComment, onNext, onPrev, onClose
  ]);

  return useKeyboardShortcuts({ shortcuts, scope: 'detail' });
};
```

### 3.2 useDashboardMetrics

**Purpose**: Загрузка данных для Dashboard.

```tsx
// File: src/hooks/useDashboardMetrics.ts

import { useState, useEffect, useCallback } from 'react';
import { fetchDashboardMetrics, fetchAlerts, fetchTrendData } from '../api/dashboard';

interface DashboardMetrics {
  totalOpen: number;
  criticalHigh: number;
  fixedThisWeek: number;
  productsAtRisk: number;
  trends: {
    totalOpen: { direction: 'up' | 'down' | 'neutral'; percent: number };
    criticalHigh: { direction: 'up' | 'down' | 'neutral'; percent: number };
    fixedThisWeek: { direction: 'up' | 'down' | 'neutral'; percent: number };
  };
}

interface Alert {
  id: string;
  type: 'sla_breach' | 'kev_active' | 'new_critical' | 'policy_fail';
  count: number;
  severity: 'critical' | 'high' | 'medium';
}

interface TrendPoint {
  date: string;
  dateFormatted: string;
  newCount: number;
  fixedCount: number;
  openCount: number;
}

interface UseDashboardMetricsResult {
  metrics: DashboardMetrics | null;
  alerts: Alert[];
  trendData: TrendPoint[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export const useDashboardMetrics = (): UseDashboardMetricsResult => {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [trendData, setTrendData] = useState<TrendPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [metricsRes, alertsRes, trendRes] = await Promise.all([
        fetchDashboardMetrics(),
        fetchAlerts(),
        fetchTrendData('30d'),
      ]);

      setMetrics(metricsRes);
      setAlerts(alertsRes);
      setTrendData(trendRes);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();

    // Auto-refresh every 5 minutes
    const interval = setInterval(fetchData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchData]);

  return {
    metrics,
    alerts,
    trendData,
    loading,
    error,
    refresh: fetchData,
  };
};
```

---

## 4. API Layer

### 4.1 Dashboard API

```tsx
// File: src/api/dashboard.ts

import { request } from './client';

export interface DashboardMetrics {
  totalOpen: number;
  criticalHigh: number;
  fixedThisWeek: number;
  productsAtRisk: number;
  trends: {
    totalOpen: { direction: 'up' | 'down' | 'neutral'; percent: number };
    criticalHigh: { direction: 'up' | 'down' | 'neutral'; percent: number };
    fixedThisWeek: { direction: 'up' | 'down' | 'neutral'; percent: number };
  };
}

export interface Alert {
  id: string;
  type: 'sla_breach' | 'kev_active' | 'new_critical' | 'policy_fail';
  count: number;
  severity: 'critical' | 'high' | 'medium';
}

export interface TrendPoint {
  date: string;
  dateFormatted: string;
  newCount: number;
  fixedCount: number;
  openCount: number;
}

export interface SeverityDistribution {
  name: string;
  value: number;
  color: string;
}

// Note: These endpoints need to be implemented in backend
// Currently aggregated from existing /findings endpoint

export const fetchDashboardMetrics = async (): Promise<DashboardMetrics> => {
  // Option 1: Dedicated endpoint (preferred)
  // return request<DashboardMetrics>('/api/v1/metrics/dashboard');

  // Option 2: Aggregate from existing endpoints
  const [openFindings, fixedFindings] = await Promise.all([
    request<{ total: number }>('/api/v1/findings?limit=0&status=new,under_review,confirmed'),
    request<{ total: number }>('/api/v1/findings?limit=0&status=mitigated&dateFrom=' + getWeekAgo()),
  ]);

  // TODO: Implement proper metrics aggregation
  return {
    totalOpen: openFindings.total,
    criticalHigh: 0,  // Need to implement
    fixedThisWeek: fixedFindings.total,
    productsAtRisk: 0,  // Need to implement
    trends: {
      totalOpen: { direction: 'neutral', percent: 0 },
      criticalHigh: { direction: 'neutral', percent: 0 },
      fixedThisWeek: { direction: 'neutral', percent: 0 },
    },
  };
};

export const fetchAlerts = async (): Promise<Alert[]> => {
  // Aggregate alert counts
  const [slaBreached, kevActive] = await Promise.all([
    request<{ total: number }>('/api/v1/findings?limit=0&slaBreached=true&status=new,under_review,confirmed'),
    request<{ total: number }>('/api/v1/findings?limit=0&kev=true&status=new,under_review,confirmed'),
  ]);

  return [
    { id: 'sla', type: 'sla_breach', count: slaBreached.total, severity: 'critical' },
    { id: 'kev', type: 'kev_active', count: kevActive.total, severity: 'high' },
  ];
};

export const fetchTrendData = async (period: '7d' | '30d' | '90d'): Promise<TrendPoint[]> => {
  // TODO: Implement backend endpoint for trend data
  // return request<TrendPoint[]>(`/api/v1/metrics/trend?period=${period}`);

  // Placeholder
  return [];
};

export const fetchSeverityDistribution = async (): Promise<SeverityDistribution[]> => {
  const response = await request<{ bands: Record<string, number> }>('/api/v1/metrics/risk');

  return [
    { name: 'Critical', value: response.bands.critical || 0, color: '#d32f2f' },
    { name: 'High', value: response.bands.high || 0, color: '#f57c00' },
    { name: 'Medium', value: response.bands.medium || 0, color: '#fbc02d' },
    { name: 'Low', value: response.bands.low || 0, color: '#388e3c' },
  ];
};

function getWeekAgo(): string {
  const date = new Date();
  date.setDate(date.getDate() - 7);
  return date.toISOString().split('T')[0];
}
```

---

## 5. Types

### 5.1 Extended Finding Types

```tsx
// File: src/types/findings.ts (additions)

// Add to existing types:

export interface FindingRiskFactors {
  impact?: {
    value?: number;
    cvss_score?: number;
    severity?: string;
  };
  likelihood?: {
    epss_score?: number;
    kev?: boolean;
    value?: number;
    known?: boolean;
    reason?: string;
  };
  asset?: {
    criticality?: string;
    multiplier?: number;
    environment?: string;
    environment_multiplier?: number;
    internet_exposed?: boolean;
    exposure_multiplier?: number;
  };
  freshness?: {
    enabled?: boolean;
    age_days?: number;
    multiplier?: number;
  };
}

export interface FindingEvent {
  id: string;
  type: 'created' | 'status_change' | 'assigned' | 'comment' | 'sla' | 'occurrence';
  timestamp: string;
  actor?: {
    id: string;
    name: string;
    email?: string;
  };
  data: {
    from?: string;
    to?: string;
    body?: string;
    occurrenceCount?: number;
    slaStatus?: string;
    importJobId?: string;
  };
}

export interface FindingRemediation {
  guidance?: string;
  codeExample?: string;
  references?: string[];
  fixedVersion?: string;
  upgradeCommand?: string;
}

export interface FindingDetailExtended extends FindingDetailDTO {
  riskFactors?: FindingRiskFactors;
  events: FindingEvent[];
  remediation?: FindingRemediation;
}
```

---

## Summary

This specification provides:

1. **4 Dashboard Components**: MetricCard, AlertsPanel, SeverityDonutChart, TrendLineChart
2. **4 Finding Detail Components**: QuickActionsBar, EvidenceTab, IntelligenceTab, TimelineTab
3. **2 Custom Hooks**: useKeyboardShortcuts, useDashboardMetrics
4. **1 API Module**: Dashboard API with aggregation from existing endpoints
5. **Extended Types**: FindingRiskFactors, FindingEvent, FindingRemediation

All components are designed to:
- Use existing API contracts from backend DTOs
- Follow Material-UI dark theme patterns
- Support keyboard navigation
- Be fully typed with TypeScript
- Handle loading and error states

---

*Version: 1.0*
*Created: 2026-01-25*
