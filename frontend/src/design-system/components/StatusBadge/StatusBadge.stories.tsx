import type { Meta, StoryObj } from '@storybook/react';
import { Stack, Typography, Box } from '@mui/material';
import {
  StatusBadge,
  SeverityBadge,
  FindingStatusBadge,
  RiskBadge,
} from './StatusBadge';

const meta: Meta<typeof StatusBadge> = {
  title: 'Design System/StatusBadge',
  component: StatusBadge,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    type: {
      control: 'select',
      options: ['severity', 'status', 'risk'],
    },
    showIcon: { control: 'boolean' },
    compact: { control: 'boolean' },
    pulse: { control: 'boolean' },
    glow: { control: 'boolean' },
  },
};

export default meta;
type Story = StoryObj<typeof StatusBadge>;

// Severity badges
export const SeverityLevels: Story = {
  render: () => (
    <Stack spacing={3}>
      <Box>
        <Typography variant="overline" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
          Default
        </Typography>
        <Stack direction="row" spacing={1}>
          <SeverityBadge severity="critical" />
          <SeverityBadge severity="high" />
          <SeverityBadge severity="medium" />
          <SeverityBadge severity="low" />
          <SeverityBadge severity="info" />
        </Stack>
      </Box>
      <Box>
        <Typography variant="overline" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
          With Icons
        </Typography>
        <Stack direction="row" spacing={1}>
          <SeverityBadge severity="critical" showIcon />
          <SeverityBadge severity="high" showIcon />
          <SeverityBadge severity="medium" showIcon />
          <SeverityBadge severity="low" showIcon />
          <SeverityBadge severity="info" showIcon />
        </Stack>
      </Box>
      <Box>
        <Typography variant="overline" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
          Compact
        </Typography>
        <Stack direction="row" spacing={1}>
          <SeverityBadge severity="critical" compact />
          <SeverityBadge severity="high" compact />
          <SeverityBadge severity="medium" compact />
          <SeverityBadge severity="low" compact />
          <SeverityBadge severity="info" compact />
        </Stack>
      </Box>
    </Stack>
  ),
};

// Status badges
export const FindingStatuses: Story = {
  render: () => (
    <Stack spacing={3}>
      <Box>
        <Typography variant="overline" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
          Active
        </Typography>
        <Stack direction="row" spacing={1} flexWrap="wrap">
          <FindingStatusBadge status="new" showIcon />
          <FindingStatusBadge status="under_review" showIcon />
          <FindingStatusBadge status="confirmed" showIcon />
        </Stack>
      </Box>
      <Box>
        <Typography variant="overline" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
          Resolved
        </Typography>
        <Stack direction="row" spacing={1} flexWrap="wrap">
          <FindingStatusBadge status="mitigated" showIcon />
          <FindingStatusBadge status="risk_accepted" showIcon />
        </Stack>
      </Box>
      <Box>
        <Typography variant="overline" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
          Dismissed
        </Typography>
        <Stack direction="row" spacing={1} flexWrap="wrap">
          <FindingStatusBadge status="false_positive" showIcon />
          <FindingStatusBadge status="out_of_scope" showIcon />
          <FindingStatusBadge status="duplicate" showIcon />
        </Stack>
      </Box>
    </Stack>
  ),
};

// Risk badges
export const RiskLevels: Story = {
  render: () => (
    <Stack spacing={2}>
      <Stack direction="row" spacing={1}>
        <RiskBadge risk="critical" />
        <RiskBadge risk="high" />
        <RiskBadge risk="medium" />
        <RiskBadge risk="low" />
        <RiskBadge risk="none" />
      </Stack>
      <Stack direction="row" spacing={1}>
        <RiskBadge risk="critical" showIcon />
        <RiskBadge risk="high" showIcon />
        <RiskBadge risk="medium" showIcon />
        <RiskBadge risk="low" showIcon />
        <RiskBadge risk="none" showIcon />
      </Stack>
    </Stack>
  ),
};

// Special effects
export const SpecialEffects: Story = {
  render: () => (
    <Stack spacing={3}>
      <Box>
        <Typography variant="overline" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
          Pulse Animation (for critical/new items)
        </Typography>
        <Stack direction="row" spacing={2}>
          <SeverityBadge severity="critical" showIcon pulse />
          <FindingStatusBadge status="new" showIcon pulse />
        </Stack>
      </Box>
      <Box>
        <Typography variant="overline" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
          Glow Effect
        </Typography>
        <Stack direction="row" spacing={2}>
          <SeverityBadge severity="critical" glow />
          <SeverityBadge severity="high" glow />
          <RiskBadge risk="critical" glow />
        </Stack>
      </Box>
    </Stack>
  ),
};

// Interactive playground
export const Playground: Story = {
  args: {
    type: 'severity',
    value: 'critical',
    showIcon: true,
    compact: false,
    pulse: false,
    glow: false,
  },
};

// Real-world example
export const RealWorldExample: Story = {
  render: () => (
    <Box
      sx={{
        p: 2,
        borderRadius: 2,
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: 'divider',
        maxWidth: 400,
      }}
    >
      <Stack spacing={2}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="subtitle2">SQL Injection in Login</Typography>
          <SeverityBadge severity="critical" compact />
        </Stack>
        <Stack direction="row" spacing={1}>
          <FindingStatusBadge status="confirmed" compact />
          <RiskBadge risk="critical" compact />
        </Stack>
        <Typography variant="caption" color="text.secondary">
          CVE-2024-1234 · Found 2 hours ago
        </Typography>
      </Stack>
    </Box>
  ),
};
