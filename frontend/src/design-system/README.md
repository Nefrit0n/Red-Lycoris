# RED LYCORIS Design System

A comprehensive design system for security-focused applications, blending bold red energy with graphite neutrals for clarity and confidence in dark interfaces.

## Philosophy

The RED LYCORIS design system embodies:

- **Bold Confidence**: Strong red accents that command attention for critical security elements
- **Calm Clarity**: Graphite neutrals that provide visual rest and hierarchy
- **Fluid Motion**: Natural animations that feel responsive yet calm
- **Accessible by Default**: Built with accessibility in mind from the ground up

## Quick Start

```tsx
import { Button, GlassCard, StatusBadge } from '@/design-system/components';
import { darkTheme, lightTheme } from '@/design-system/theme';
import { primitives, semantic } from '@/design-system/tokens';

// Use components
<Button variant="glow" color="lotus">Action</Button>
<GlassCard variant="light" title="Dashboard">Content</GlassCard>
<StatusBadge type="severity" value="critical" showIcon />
```

## Architecture

```
design-system/
├── components/           # UI components
│   ├── Button/          # Enhanced button with variants
│   ├── GlassCard/       # Glassmorphism card
│   ├── StatusBadge/     # Severity/status badges
│   ├── MetricDisplay/   # KPI and metric displays
│   └── Chart/           # Chart wrappers
├── theme/               # MUI theme configuration
│   ├── theme.ts         # Dark/Light themes
│   └── augmentation.d.ts # TypeScript extensions
├── tokens/              # Design tokens
│   ├── colors.ts        # Color palette
│   ├── typography.ts    # Font system
│   ├── spacing.ts       # Spacing scale
│   ├── animations.ts    # Motion tokens
│   ├── borders.ts       # Border radii
│   ├── effects.ts       # Glass/blur effects
│   ├── shadows.ts       # Elevation system
│   └── charts.ts        # Chart-specific tokens
└── utils/               # Utility functions
```

## Design Tokens

### Colors

#### Brand Colors

| Token | Value | Usage |
|-------|-------|-------|
| `primitives.lotus[500]` | `#e11d48` | Primary brand red |
| `primitives.petal[500]` | `#e94532` | Warm accent red |
| `primitives.jade[500]` | `#1fc3bc` | Secondary teal |
| `primitives.gold[500]` | `#f0a500` | Highlight gold |

#### Semantic Colors

```tsx
// Severity levels
semantic.severity.critical.base  // Purple - #9333ea
semantic.severity.high.base      // Red - #dc2626
semantic.severity.medium.base    // Orange - #ea580c
semantic.severity.low.base       // Green - #16a34a
semantic.severity.info.base      // Blue - #0ea5e9

// Status colors
semantic.status.new.base         // Blue - #3b82f6
semantic.status.inProgress.base  // Amber - #f59e0b
semantic.status.resolved.base    // Green - #10b981
semantic.status.dismissed.base   // Gray - #6b7280
```

### Typography

Based on a **Perfect Fourth** scale (1.333):

```tsx
// Font families
fontFamily.sans    // 'Inter', system fonts
fontFamily.mono    // 'JetBrains Mono', monospace

// Font sizes
fontSize.xs        // 0.75rem (12px)
fontSize.sm        // 0.875rem (14px)
fontSize.base      // 1rem (16px)
fontSize.lg        // 1.125rem (18px)
fontSize.xl        // 1.25rem (20px)
// ... up to 4.5rem for display text
```

### Spacing

Based on a **4px grid**:

```tsx
spacing.micro.xxs  // 2px
spacing.micro.xs   // 4px
spacing.small.sm   // 8px
spacing.small.md   // 12px
spacing.medium.lg  // 16px
spacing.medium.xl  // 24px
spacing.large.xxl  // 32px
// ... up to 256px
```

### Borders

```tsx
radius.xs          // 2px
radius.sm          // 4px
radius.md          // 6px (default)
radius.lg          // 8px
radius.xl          // 12px
radius.full        // 9999px (pills)
```

### Shadows

```tsx
// Dark theme shadows
elevationDark.xs   // Subtle shadow
elevationDark.sm   // Small shadow
elevationDark.md   // Medium shadow
elevationDark.lg   // Large shadow
elevationDark.xl   // Extra large

// Glow effects
glow.lotus.subtle  // Red glow
glow.jade.subtle   // Teal glow
glow.gold.subtle   // Gold glow
```

## Components

### Button

Enhanced button with glassmorphism and glow effects.

```tsx
// Variants
<Button variant="contained">Default</Button>
<Button variant="outlined">Outlined</Button>
<Button variant="text">Text</Button>
<Button variant="glass">Glass</Button>
<Button variant="glow" color="lotus">Glow</Button>

// Colors
<Button color="primary">Primary</Button>
<Button color="lotus">Lotus Red</Button>
<Button color="jade">Jade Teal</Button>
<Button color="gold">Gold</Button>

// States
<Button loading loadingText="Saving...">Save</Button>
<Button startIcon={<SaveIcon />}>With Icon</Button>
```

### GlassCard

Premium card with glassmorphism effects.

```tsx
// Variants
<GlassCard variant="subtle">Subtle blur</GlassCard>
<GlassCard variant="light">Light (default)</GlassCard>
<GlassCard variant="medium">Medium blur</GlassCard>
<GlassCard variant="heavy">Heavy blur</GlassCard>
<GlassCard variant="lotus">Lotus gradient</GlassCard>
<GlassCard variant="solid">Solid background</GlassCard>

// With header
<GlassCard
  title="Dashboard"
  subtitle="Overview"
  headerAction={<IconButton><MoreIcon /></IconButton>}
>
  Content
</GlassCard>

// Interactive
<GlassCard
  interactive
  onClick={handleClick}
  glowColor="lotus"
  aria-label="Click to view details"
>
  Clickable card
</GlassCard>
```

### StatusBadge

Unified badge for severity, status, and risk levels.

```tsx
// Severity
<StatusBadge type="severity" value="critical" showIcon />
<StatusBadge type="severity" value="high" />
<StatusBadge type="severity" value="medium" />
<StatusBadge type="severity" value="low" />

// Status
<StatusBadge type="status" value="new" showIcon />
<StatusBadge type="status" value="under_review" />
<StatusBadge type="status" value="mitigated" />

// Risk
<StatusBadge type="risk" value="critical" glow />

// Compact mode
<StatusBadge type="severity" value="high" compact />
```

### MetricDisplay

Display KPIs and metrics with trends.

```tsx
<MetricDisplay
  label="Total Findings"
  value={1234}
  trend={{ direction: 'down', value: 12 }}
  icon={<BugIcon />}
/>
```

## Accessibility

### Reduced Motion

All animations respect the user's `prefers-reduced-motion` preference:

```tsx
// Using the hook
import { useReducedMotion } from '@/hooks';

const { prefersReducedMotion, getTransition } = useReducedMotion();

const styles = {
  transition: getTransition('all 0.3s ease'),
};

// Using CSS-in-JS helper
import { reducedMotionStyles } from '@/hooks';

const styles = {
  ...reducedMotionStyles({
    transition: 'all 0.3s ease',
    animation: 'fadeIn 0.5s ease',
  }),
};
```

### ARIA Support

All components include proper ARIA attributes:

```tsx
// StatusBadge with accessible label
<StatusBadge
  type="severity"
  value="critical"
  aria-label="Severity: Critical security issue"
/>

// GlassCard with accessibility
<GlassCard
  interactive
  aria-label="Click to open finding details"
  aria-describedby="finding-description"
>
  Content
</GlassCard>
```

### Focus Management

- All interactive elements have visible focus indicators
- Focus rings use the design system's focus ring tokens
- Keyboard navigation is fully supported

```tsx
// Focus ring styling
'&:focus-visible': {
  boxShadow: focusRing.default,
  outline: 'none',
}
```

## Theming

### Dark Theme (Default)

```tsx
import { darkTheme } from '@/design-system/theme';

<ThemeProvider theme={darkTheme}>
  <App />
</ThemeProvider>
```

### Light Theme

```tsx
import { lightTheme } from '@/design-system/theme';

<ThemeProvider theme={lightTheme}>
  <App />
</ThemeProvider>
```

### Theme Context

```tsx
import { useThemeMode } from '@/contexts/ThemeContext';

const { mode, setMode, toggleMode, isDark } = useThemeMode();

// Toggle theme
<IconButton onClick={toggleMode}>
  {isDark ? <LightModeIcon /> : <DarkModeIcon />}
</IconButton>
```

## Storybook

View and test components in isolation:

```bash
npm run storybook      # Start on port 6006
npm run build-storybook  # Build static docs
```

## Performance

### Virtualization

For large lists, use the VirtualizedDataTable component:

```tsx
import { VirtualizedDataTable } from '@/components/VirtualizedDataTable';

<VirtualizedDataTable
  data={findings}
  rowHeight={56}
  getRowKey={(item) => item.id}
  renderRow={({ data, style }) => (
    <TableRow style={style}>{/* ... */}</TableRow>
  )}
  renderHeader={() => <TableHead>{/* ... */}</TableHead>}
/>
```

## Best Practices

1. **Use semantic colors** for status indicators
2. **Prefer design tokens** over hardcoded values
3. **Include ARIA labels** for all interactive elements
4. **Test with reduced motion** enabled
5. **Use the right component variant** for the context

## Contributing

When adding new components or tokens:

1. Follow the existing naming conventions
2. Add TypeScript types
3. Include Storybook stories
4. Test accessibility with jest-axe
5. Document in this README

## License

Proprietary - Lotus Warden
