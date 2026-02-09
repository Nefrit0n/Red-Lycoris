import type { Meta, StoryObj } from '@storybook/react';
import { Stack } from '@mui/material';
import { Save, Send, Delete, Settings, Add } from '@mui/icons-material';
import { Button } from './Button';

const meta: Meta<typeof Button> = {
  title: 'Design System/Button',
  component: Button,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['contained', 'outlined', 'text', 'glass', 'glow'],
    },
    color: {
      control: 'select',
      options: ['primary', 'secondary', 'lotus', 'petal', 'jade', 'gold', 'error'],
    },
    size: {
      control: 'select',
      options: ['small', 'medium', 'large'],
    },
    loading: { control: 'boolean' },
    disabled: { control: 'boolean' },
    fullWidth: { control: 'boolean' },
  },
};

export default meta;
type Story = StoryObj<typeof Button>;

// Basic variants
export const Default: Story = {
  args: {
    children: 'Button',
  },
};

export const Variants: Story = {
  render: () => (
    <Stack direction="row" spacing={2} flexWrap="wrap">
      <Button variant="contained">Contained</Button>
      <Button variant="outlined">Outlined</Button>
      <Button variant="text">Text</Button>
      <Button variant="glass">Glass</Button>
      <Button variant="glow">Glow</Button>
    </Stack>
  ),
};

// Brand colors
export const Colors: Story = {
  render: () => (
    <Stack spacing={2}>
      <Stack direction="row" spacing={2} flexWrap="wrap">
        <Button color="lotus">Red Lycoris</Button>
        <Button color="petal">Petal</Button>
        <Button color="jade">Jade</Button>
        <Button color="gold">Gold</Button>
        <Button color="error">Error</Button>
      </Stack>
      <Stack direction="row" spacing={2} flexWrap="wrap">
        <Button variant="glow" color="lotus">Red Lycoris Glow</Button>
        <Button variant="glow" color="petal">Petal Glow</Button>
        <Button variant="glow" color="jade">Jade Glow</Button>
        <Button variant="glow" color="gold">Gold Glow</Button>
      </Stack>
    </Stack>
  ),
};

// Sizes
export const Sizes: Story = {
  render: () => (
    <Stack direction="row" spacing={2} alignItems="center">
      <Button size="small">Small</Button>
      <Button size="medium">Medium</Button>
      <Button size="large">Large</Button>
    </Stack>
  ),
};

// With icons
export const WithIcons: Story = {
  render: () => (
    <Stack direction="row" spacing={2} flexWrap="wrap">
      <Button startIcon={<Save />}>Save</Button>
      <Button endIcon={<Send />}>Send</Button>
      <Button startIcon={<Add />} variant="glow" color="jade">
        Add New
      </Button>
      <Button startIcon={<Delete />} color="error">
        Delete
      </Button>
      <Button startIcon={<Settings />} variant="glass">
        Settings
      </Button>
    </Stack>
  ),
};

// Loading states
export const Loading: Story = {
  render: () => (
    <Stack direction="row" spacing={2}>
      <Button loading>Loading</Button>
      <Button loading loadingText="Saving...">Save</Button>
      <Button loading loadingPosition="start" startIcon={<Save />}>
        Save
      </Button>
      <Button loading variant="glow" color="lotus">
        Processing
      </Button>
    </Stack>
  ),
};

// Glass variant showcase
export const GlassVariant: Story = {
  render: () => (
    <Stack 
      direction="row" 
      spacing={2} 
      sx={{ 
        p: 4, 
        borderRadius: 2,
        background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.2) 0%, rgba(232, 85, 168, 0.1) 100%)',
      }}
    >
      <Button variant="glass">Glass Button</Button>
      <Button variant="glass" startIcon={<Settings />}>
        Settings
      </Button>
    </Stack>
  ),
};

// Glow variant showcase
export const GlowVariant: Story = {
  render: () => (
    <Stack direction="row" spacing={2}>
      <Button variant="glow" color="lotus">Red Lycoris Glow</Button>
      <Button variant="glow" color="petal">Petal Glow</Button>
      <Button variant="glow" color="jade">Jade Glow</Button>
      <Button variant="glow" color="gold">Gold Glow</Button>
      <Button variant="glow" color="error">Error Glow</Button>
    </Stack>
  ),
};

// Disabled state
export const Disabled: Story = {
  render: () => (
    <Stack direction="row" spacing={2}>
      <Button disabled>Disabled</Button>
      <Button disabled variant="outlined">Disabled</Button>
      <Button disabled variant="glow">Disabled</Button>
    </Stack>
  ),
};
