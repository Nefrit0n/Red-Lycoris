import type { Meta, StoryObj } from '@storybook/react';
import { Stack, Box } from '@mui/material';
import {
  Security,
  BugReport,
  Speed,
  Shield,
  Warning,
  CheckCircle,
} from '@mui/icons-material';
import { MetricDisplay } from './MetricDisplay';

const meta: Meta<typeof MetricDisplay> = {
  title: 'Design System/MetricDisplay',
  component: MetricDisplay,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    size: {
      control: 'select',
      options: ['small', 'medium', 'large', 'hero'],
    },
    color: {
      control: 'select',
      options: ['default', 'lotus', 'petal', 'jade', 'gold', 'success', 'warning', 'error'],
    },
    variant: {
      control: 'select',
      options: ['subtle', 'light', 'medium', 'solid'],
    },
    loading: { control: 'boolean' },
    animate: { control: 'boolean' },
    colorBar: { control: 'boolean' },
    percentage: { control: 'boolean' },
    formatted: { control: 'boolean' },
  },
};

export default meta;
type Story = StoryObj<typeof MetricDisplay>;

// Basic metrics
export const BasicMetrics: Story = {
  render: () => (
    <Stack direction="row" spacing={2} flexWrap="wrap">
      <MetricDisplay
        value={1234}
        title="Total Findings"
        sx={{ width: 200 }}
      />
      <MetricDisplay
        value={42}
        title="Critical Issues"
        color="error"
        sx={{ width: 200 }}
      />
      <MetricDisplay
        value={98.5}
        title="Security Score"
        suffix="%"
        color="jade"
        sx={{ width: 200 }}
      />
    </Stack>
  ),
};

// Size variants
export const Sizes: Story = {
  render: () => (
    <Stack direction="row" spacing={2} alignItems="flex-start" flexWrap="wrap">
      <MetricDisplay
        value={256}
        title="Small"
        size="small"
        sx={{ width: 150 }}
      />
      <MetricDisplay
        value={512}
        title="Medium"
        size="medium"
        sx={{ width: 180 }}
      />
      <MetricDisplay
        value={1024}
        title="Large"
        size="large"
        sx={{ width: 200 }}
      />
      <MetricDisplay
        value={2048}
        title="Hero"
        size="hero"
        sx={{ width: 250 }}
      />
    </Stack>
  ),
};

// With trends
export const WithTrends: Story = {
  render: () => (
    <Stack direction="row" spacing={2} flexWrap="wrap">
      <MetricDisplay
        value={156}
        title="Open Issues"
        trend={{ value: 12, direction: 'up', isPositive: false, label: 'vs last week' }}
        color="error"
        sx={{ width: 220 }}
      />
      <MetricDisplay
        value={89}
        title="Resolved"
        trend={{ value: 23, direction: 'up', isPositive: true, label: 'vs last week' }}
        color="success"
        sx={{ width: 220 }}
      />
      <MetricDisplay
        value={45}
        title="In Progress"
        trend={{ value: 5, direction: 'down', isPositive: true, label: 'vs last week' }}
        color="warning"
        sx={{ width: 220 }}
      />
    </Stack>
  ),
};

// With icons
export const WithIcons: Story = {
  render: () => (
    <Stack direction="row" spacing={2} flexWrap="wrap">
      <MetricDisplay
        value={98}
        title="Security Score"
        suffix="%"
        icon={<Security />}
        color="jade"
        sx={{ width: 220 }}
      />
      <MetricDisplay
        value={23}
        title="Critical Bugs"
        icon={<BugReport />}
        color="error"
        sx={{ width: 220 }}
      />
      <MetricDisplay
        value={142}
        title="Scan Speed"
        suffix="ms"
        icon={<Speed />}
        color="lotus"
        sx={{ width: 220 }}
      />
    </Stack>
  ),
};

// With sparkline
export const WithSparkline: Story = {
  render: () => (
    <Stack direction="row" spacing={2} flexWrap="wrap">
      <MetricDisplay
        value={234}
        title="Weekly Scans"
        sparkline={[12, 19, 15, 22, 18, 25, 30, 28, 35, 32, 40, 38]}
        color="lotus"
        sx={{ width: 280 }}
      />
      <MetricDisplay
        value={67}
        title="Vulnerabilities Found"
        sparkline={[45, 52, 48, 60, 55, 58, 62, 70, 65, 68, 72, 67]}
        color="warning"
        trend={{ value: 8, direction: 'up', isPositive: false }}
        sx={{ width: 280 }}
      />
    </Stack>
  ),
};

// Color bar indicator
export const ColorBarIndicator: Story = {
  render: () => (
    <Stack direction="row" spacing={2} flexWrap="wrap">
      <MetricDisplay
        value={42}
        title="Critical"
        color="error"
        colorBar
        variant="solid"
        sx={{ width: 180 }}
      />
      <MetricDisplay
        value={89}
        title="High"
        color="warning"
        colorBar
        variant="solid"
        sx={{ width: 180 }}
      />
      <MetricDisplay
        value={156}
        title="Medium"
        color="gold"
        colorBar
        variant="solid"
        sx={{ width: 180 }}
      />
      <MetricDisplay
        value={234}
        title="Low"
        color="success"
        colorBar
        variant="solid"
        sx={{ width: 180 }}
      />
    </Stack>
  ),
};

// Animated counter
export const AnimatedCounter: Story = {
  render: () => (
    <Stack direction="row" spacing={2}>
      <MetricDisplay
        value={12847}
        title="Total Scans"
        animate
        animationDuration={2000}
        color="lotus"
        size="large"
        sx={{ width: 250 }}
      />
      <MetricDisplay
        value={99.7}
        title="Uptime"
        suffix="%"
        animate
        animationDuration={1500}
        decimals={1}
        color="jade"
        size="large"
        sx={{ width: 250 }}
      />
    </Stack>
  ),
};

// Loading state
export const LoadingState: Story = {
  render: () => (
    <Stack direction="row" spacing={2}>
      <MetricDisplay
        value={0}
        title="Loading..."
        loading
        sx={{ width: 200 }}
      />
      <MetricDisplay
        value={0}
        title="Loading with trend..."
        trend={{ value: 0, direction: 'flat' }}
        loading
        sx={{ width: 220 }}
      />
      <MetricDisplay
        value={0}
        title="Loading with sparkline..."
        sparkline={[]}
        loading
        sx={{ width: 280 }}
      />
    </Stack>
  ),
};

// Number formatting
export const NumberFormatting: Story = {
  render: () => (
    <Stack direction="row" spacing={2} flexWrap="wrap">
      <MetricDisplay
        value={1234567}
        title="With Separators"
        formatted
        sx={{ width: 200 }}
      />
      <MetricDisplay
        value={1234567}
        title="No Separators"
        formatted={false}
        sx={{ width: 200 }}
      />
      <MetricDisplay
        value={42.567}
        title="2 Decimals"
        decimals={2}
        sx={{ width: 200 }}
      />
      <MetricDisplay
        value={9999}
        title="With Prefix"
        prefix="$"
        sx={{ width: 200 }}
      />
    </Stack>
  ),
};

// Dashboard example
export const DashboardExample: Story = {
  render: () => (
    <Box
      sx={{
        p: 3,
        background: 'linear-gradient(180deg, rgba(168, 85, 247, 0.05) 0%, transparent 100%)',
        borderRadius: 2,
      }}
    >
      <Stack spacing={2}>
        <Stack direction="row" spacing={2}>
          <MetricDisplay
            value={98.5}
            title="Security Score"
            suffix="%"
            icon={<Shield />}
            color="jade"
            size="large"
            trend={{ value: 2.3, direction: 'up', isPositive: true, label: 'vs last month' }}
            glowColor="jade"
            glowAlways
            sx={{ flex: 1 }}
          />
        </Stack>
        <Stack direction="row" spacing={2}>
          <MetricDisplay
            value={23}
            title="Critical"
            icon={<Warning />}
            color="error"
            colorBar
            variant="solid"
            trend={{ value: 5, direction: 'down', isPositive: true }}
            sx={{ flex: 1 }}
          />
          <MetricDisplay
            value={67}
            title="High"
            color="warning"
            colorBar
            variant="solid"
            sx={{ flex: 1 }}
          />
          <MetricDisplay
            value={189}
            title="Resolved"
            icon={<CheckCircle />}
            color="success"
            colorBar
            variant="solid"
            trend={{ value: 12, direction: 'up', isPositive: true }}
            sx={{ flex: 1 }}
          />
        </Stack>
      </Stack>
    </Box>
  ),
};

// Playground
export const Playground: Story = {
  args: {
    value: 1234,
    title: 'Metric Title',
    subtitle: 'Optional subtitle',
    size: 'medium',
    color: 'default',
    variant: 'light',
    loading: false,
    animate: false,
    colorBar: false,
    formatted: true,
    decimals: 0,
  },
};
