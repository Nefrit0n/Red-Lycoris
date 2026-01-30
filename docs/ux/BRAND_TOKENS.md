# RED LYCORIS Brand Tokens

This document summarizes the RED LYCORIS design tokens used by the dark theme. Tokens live in `frontend/src/design-system/tokens` and are consumed by the MUI theme in `frontend/src/design-system/theme/theme.ts`.

## Palette

**Core neutrals (Graphite)**
- `night.950` → #050507
- `night.800` → #171821 (app background)
- `night.700` → #252730 (surface/card)
- `night.500` → #494f63 (strong borders)
- `night.200` → #aab0c3 (secondary text)

**Brand (Lycoris red)**
- Primary: `lotus.500` → #e11d48
- Hover: `lotus.400` → #f04f69
- Active: `lotus.600` → #a11f2f
- Subtle tint: rgba(225, 29, 72, 0.18)

**Accent (Ember)**
- Accent: `petal.500` → #e94532
- Accent hover: `petal.400` → #f46c5d

**State colors**
- Success: #10b981
- Warning: #f59e0b
- Error: #ef4444
- Info: #3b82f6

## Typography

- Family: `fontFamily.sans` (system sans stack)
- Body: `textStyles.body.md` (16px / 1.6)
- Headings: `textStyles.heading.h1–h6`
- Labels/buttons: `textStyles.label.*` + `textStyles.button.*`

## Radii

Unified component radius tokens:
- `radius.button` = `radius.input` = `radius.card` = **12px** (`0.75rem`)
- `radius.modal` = 16px (`1rem`)
- `radius.full` = 9999px (pills/chips)

## Spacing & Layout

- Base spacing scale: `space.1`–`space.12`
- Control sizing: buttons and inputs default to **40px** height in the dark theme.

## Shadows & Focus

- Default elevation: `elevationDark.sm`
- Focus ring: `focusRing.default` (graphite offset + lycoris ring)

## Component Examples

**Primary Button**
- Background: `brand.primary` (#e11d48)
- Hover: `brand.primaryHover`
- Focus: `focusRing.default`

**Card**
- Background: `bg.surface` (#252730)
- Border: `border.subtle`
- Radius: `radius.card` (12px)

**Inputs**
- Border: `border.strong`
- Focus border + ring: `border.focus` + `focusRing.default`

---

For implementation details, reference:
- `frontend/src/design-system/tokens/colors.ts`
- `frontend/src/design-system/theme/theme.ts`
