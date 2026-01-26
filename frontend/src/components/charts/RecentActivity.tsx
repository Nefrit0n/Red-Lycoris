/**
 * RecentActivity - Displays recent activity feed
 *
 * Uses design system tokens for consistent styling.
 */

import { Box, Typography, Stack, Chip } from '@mui/material';
import {
  BugReport as BugReportIcon,
  CheckCircle as CheckCircleIcon,
  Upload as UploadIcon,
} from '@mui/icons-material';
import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';
import { ChartContainer } from '../../design-system/components';
import { chartColors } from '../../design-system/tokens';
import { primitives, semantic, alpha } from '../../design-system/tokens/colors';

// ============================================================
// TYPES
// ============================================================

export type ActivityItem = {
  id: string;
  type: 'new_finding' | 'status_change' | 'scan_upload';
  title: string;
  description?: string;
  severity?: string;
  timestamp: string;
};

type RecentActivityProps = {
  data: ActivityItem[];
  title?: string;
  loading?: boolean;
  maxItems?: number;
};

// ============================================================
// CONFIG
// ============================================================

const ACTIVITY_ICONS = {
  new_finding: <BugReportIcon fontSize="small" />,
  status_change: <CheckCircleIcon fontSize="small" />,
  scan_upload: <UploadIcon fontSize="small" />,
};

const ACTIVITY_COLORS = chartColors.activity;

const SEVERITY_COLORS: Record<string, string> = {
  critical: semantic.severity.critical.base,
  high: semantic.severity.high.base,
  medium: semantic.severity.medium.base,
  low: semantic.severity.low.base,
};

// ============================================================
// COMPONENT
// ============================================================

const RecentActivity = ({
  data,
  title = 'Recent Activity',
  loading = false,
  maxItems = 8,
}: RecentActivityProps) => {
  const items = data.slice(0, maxItems);
  const hasData = items.length > 0;

  return (
    <ChartContainer
      title={title}
      loading={loading}
      hasData={hasData}
      loadingVariant="list"
      emptyMessage="No recent activity"
      height={300}
    >
      <Stack spacing={0} sx={{ flex: 1, overflowY: 'auto' }}>
        {items.map((item, index) => (
          <Box
            key={item.id}
            sx={{
              display: 'flex',
              gap: 2,
              py: 1.5,
              borderBottom: index < items.length - 1 ? '1px solid' : 'none',
              borderColor: primitives.night[600],
            }}
          >
            <Box
              sx={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                bgcolor: alpha.white[10],
                color: ACTIVITY_COLORS[item.type],
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              {ACTIVITY_ICONS[item.type]}
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                <Typography
                  variant="body2"
                  fontWeight={500}
                  noWrap
                  sx={{ maxWidth: '70%', color: primitives.night[100] }}
                >
                  {item.title}
                </Typography>
                {item.severity && (
                  <Chip
                    label={item.severity}
                    size="small"
                    sx={{
                      height: 18,
                      fontSize: 10,
                      fontWeight: 600,
                      bgcolor: `${SEVERITY_COLORS[item.severity] || primitives.night[500]}20`,
                      color: SEVERITY_COLORS[item.severity] || primitives.night[300],
                    }}
                  />
                )}
              </Box>
              {item.description && (
                <Typography
                  variant="caption"
                  noWrap
                  display="block"
                  sx={{ color: primitives.night[300] }}
                >
                  {item.description}
                </Typography>
              )}
              <Typography variant="caption" sx={{ color: primitives.night[400] }}>
                {formatDistanceToNow(new Date(item.timestamp), { addSuffix: true, locale: ru })}
              </Typography>
            </Box>
          </Box>
        ))}
      </Stack>
    </ChartContainer>
  );
};

export default RecentActivity;
