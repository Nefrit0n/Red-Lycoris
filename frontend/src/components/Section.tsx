/**
 * Section Component
 *
 * Reusable section wrapper built on the Red Lycoris design system.
 * Provides consistent styling for content sections.
 */

import { Box, Stack, Typography } from '@mui/material';
import { GlassCard } from '../design-system/components';
import type { GlassVariant } from '../design-system/components/GlassCard';

interface SectionProps {
  /** Section title */
  title: React.ReactNode;
  /** Optional subtitle */
  subtitle?: string;
  /** Content for the right side of the header */
  right?: React.ReactNode;
  /** Section content */
  children: React.ReactNode;
  /** Compact mode with less padding */
  dense?: boolean;
  /** Glass card variant */
  variant?: GlassVariant;
  /** Disable the glass effect */
  solid?: boolean;
}

/**
 * Reusable section component with title and optional right content
 *
 * @example
 * <Section title="Recent Activity" right={<Button>View All</Button>}>
 *   <ActivityList items={activities} />
 * </Section>
 */
export const Section = ({
  title,
  subtitle,
  right,
  children,
  dense,
  variant = 'solid',
  solid = true,
}: SectionProps) => (
  <GlassCard
    variant={solid ? 'solid' : variant}
    padding={dense ? 'compact' : 'normal'}
    disableHover
  >
    <Stack
      direction="row"
      alignItems="flex-start"
      justifyContent="space-between"
      gap={2}
      sx={{ mb: dense ? 1.5 : 2 }}
    >
      <Box>
        <Typography
          variant="subtitle2"
          sx={{
            fontWeight: 600,
            color: 'text.primary',
            letterSpacing: '0.01em',
          }}
        >
          {title}
        </Typography>
        {subtitle && (
          <Typography
            variant="caption"
            sx={{ color: 'text.secondary', mt: 0.25, display: 'block' }}
          >
            {subtitle}
          </Typography>
        )}
      </Box>
      {right}
    </Stack>
    {children}
  </GlassCard>
);

export default Section;
