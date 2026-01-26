import type { Meta, StoryObj } from '@storybook/react';
import { Stack, Typography, Box, IconButton } from '@mui/material';
import { MoreVert, Security, TrendingUp } from '@mui/icons-material';
import { GlassCard } from './GlassCard';

const meta: Meta<typeof GlassCard> = {
  title: 'Design System/GlassCard',
  component: GlassCard,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['subtle', 'light', 'medium', 'heavy', 'lotus', 'solid'],
    },
    glowColor: {
      control: 'select',
      options: ['none', 'lotus', 'petal', 'jade', 'gold'],
    },
    padding: {
      control: 'select',
      options: ['none', 'compact', 'normal', 'comfortable'],
    },
    glowAlways: { control: 'boolean' },
    disableHover: { control: 'boolean' },
    interactive: { control: 'boolean' },
    selected: { control: 'boolean' },
  },
};

export default meta;
type Story = StoryObj<typeof GlassCard>;

// Glass variants
export const GlassVariants: Story = {
  render: () => (
    <Box
      sx={{
        p: 4,
        background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.15) 0%, rgba(34, 211, 206, 0.1) 100%)',
        borderRadius: 2,
      }}
    >
      <Stack direction="row" spacing={2} flexWrap="wrap">
        <GlassCard variant="subtle" sx={{ width: 150, height: 100 }}>
          <Typography variant="caption">Subtle</Typography>
        </GlassCard>
        <GlassCard variant="light" sx={{ width: 150, height: 100 }}>
          <Typography variant="caption">Light</Typography>
        </GlassCard>
        <GlassCard variant="medium" sx={{ width: 150, height: 100 }}>
          <Typography variant="caption">Medium</Typography>
        </GlassCard>
        <GlassCard variant="heavy" sx={{ width: 150, height: 100 }}>
          <Typography variant="caption">Heavy</Typography>
        </GlassCard>
        <GlassCard variant="lotus" sx={{ width: 150, height: 100 }}>
          <Typography variant="caption">Lotus</Typography>
        </GlassCard>
        <GlassCard variant="solid" sx={{ width: 150, height: 100 }}>
          <Typography variant="caption">Solid</Typography>
        </GlassCard>
      </Stack>
    </Box>
  ),
};

// Glow effects
export const GlowEffects: Story = {
  render: () => (
    <Stack direction="row" spacing={2} flexWrap="wrap">
      <GlassCard glowColor="lotus" glowAlways sx={{ width: 150, height: 100 }}>
        <Typography variant="caption">Lotus Glow</Typography>
      </GlassCard>
      <GlassCard glowColor="petal" glowAlways sx={{ width: 150, height: 100 }}>
        <Typography variant="caption">Petal Glow</Typography>
      </GlassCard>
      <GlassCard glowColor="jade" glowAlways sx={{ width: 150, height: 100 }}>
        <Typography variant="caption">Jade Glow</Typography>
      </GlassCard>
      <GlassCard glowColor="gold" glowAlways sx={{ width: 150, height: 100 }}>
        <Typography variant="caption">Gold Glow</Typography>
      </GlassCard>
    </Stack>
  ),
};

// With header
export const WithHeader: Story = {
  render: () => (
    <GlassCard
      title="Security Overview"
      subtitle="Last 30 days performance"
      headerAction={
        <IconButton size="small">
          <MoreVert fontSize="small" />
        </IconButton>
      }
      sx={{ width: 350 }}
    >
      <Typography color="text.secondary">
        Card content goes here. This demonstrates the header with title,
        subtitle, and action button.
      </Typography>
    </GlassCard>
  ),
};

// With footer
export const WithFooter: Story = {
  render: () => (
    <GlassCard
      title="Recent Activity"
      footer={
        <Typography variant="caption" color="text.secondary">
          Updated 5 minutes ago
        </Typography>
      }
      sx={{ width: 350 }}
    >
      <Typography color="text.secondary">
        Card content with a footer section.
      </Typography>
    </GlassCard>
  ),
};

// Interactive cards
export const InteractiveCards: Story = {
  render: () => (
    <Stack direction="row" spacing={2}>
      <GlassCard
        interactive
        onClick={() => alert('Card clicked!')}
        title="Click Me"
        sx={{ width: 200 }}
      >
        <Typography variant="body2" color="text.secondary">
          Interactive card with hover and click effects
        </Typography>
      </GlassCard>
      <GlassCard
        interactive
        glowColor="lotus"
        onClick={() => alert('Glow card clicked!')}
        title="Glow on Hover"
        sx={{ width: 200 }}
      >
        <Typography variant="body2" color="text.secondary">
          With lotus glow effect
        </Typography>
      </GlassCard>
    </Stack>
  ),
};

// Selected state
export const SelectedState: Story = {
  render: () => (
    <Stack direction="row" spacing={2}>
      <GlassCard sx={{ width: 180 }} title="Normal">
        <Typography variant="body2" color="text.secondary">
          Not selected
        </Typography>
      </GlassCard>
      <GlassCard selected glowColor="lotus" sx={{ width: 180 }} title="Selected">
        <Typography variant="body2" color="text.secondary">
          Selected state
        </Typography>
      </GlassCard>
    </Stack>
  ),
};

// Padding variants
export const PaddingVariants: Story = {
  render: () => (
    <Stack direction="row" spacing={2}>
      <GlassCard padding="compact" sx={{ width: 150 }}>
        <Typography variant="caption">Compact</Typography>
      </GlassCard>
      <GlassCard padding="normal" sx={{ width: 150 }}>
        <Typography variant="caption">Normal</Typography>
      </GlassCard>
      <GlassCard padding="comfortable" sx={{ width: 150 }}>
        <Typography variant="caption">Comfortable</Typography>
      </GlassCard>
    </Stack>
  ),
};

// Lotus branded card
export const LotusBrandedCard: Story = {
  render: () => (
    <GlassCard
      variant="lotus"
      glowColor="lotus"
      glowAlways
      title="Security Score"
      subtitle="Overall system health"
      headerAction={<Security sx={{ color: 'primary.main' }} />}
      sx={{ width: 300 }}
    >
      <Box sx={{ textAlign: 'center', py: 2 }}>
        <Typography
          variant="h2"
          sx={{
            fontWeight: 700,
            background: 'linear-gradient(135deg, #a855f7 0%, #e855a8 100%)',
            backgroundClip: 'text',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          98%
        </Typography>
        <Stack direction="row" justifyContent="center" alignItems="center" spacing={0.5}>
          <TrendingUp sx={{ color: 'success.main', fontSize: 16 }} />
          <Typography variant="body2" color="success.main">
            +5% from last month
          </Typography>
        </Stack>
      </Box>
    </GlassCard>
  ),
};

// Playground
export const Playground: Story = {
  args: {
    variant: 'light',
    glowColor: 'none',
    padding: 'normal',
    title: 'Card Title',
    subtitle: 'Card subtitle',
    children: 'Card content goes here',
    glowAlways: false,
    interactive: false,
    selected: false,
  },
};
