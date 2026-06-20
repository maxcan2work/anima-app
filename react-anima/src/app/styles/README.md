# Anima UI tokens

The UI layer uses two token groups:

- `tokens.css` contains theme-independent scales: spacing, typography, radii, control sizes, motion, and shadows.
- `themes.css` contains semantic colors. Components must use semantic names instead of raw color values.

## Usage rules

- Use `--space-*` for gaps, padding, and margins.
- Use typography roles such as `--font-size-body`, `--font-size-label`, and `--font-size-title`.
- Use only the defined font weights. Avoid custom values such as `850` and `950`.
- Use `--radius-sm`, `--radius-md`, or `--radius-lg`. Pills use `--radius-pill`.
- Interactive controls use `--control-height-sm`, `--control-height-md`, or `--control-height-lg`.
- Use semantic surfaces and borders such as `--color-surface-control` and `--color-border-subtle`.
- Prefer components from `shared/ui` before styling a new button, tooltip, modal, or toast.
- Import public components from `@shared/ui`. Do not import their internal files from feature or page code.
- Keep the global `focus-visible` ring. Do not remove outlines without an accessible replacement.

## Current primitives

- `Button`
- `Field` and `InputField`
- `Checkbox`
- `CollapsibleSection`
- `IconButton`
- `RangeSlider`
- `SectionHeader`
- `Select`
- `Skeleton`
- `SegmentedControl`
- `Toggle`
- `Tooltip`

## Migration order

1. Shared UI components.
2. Sidebars and repeated control surfaces.
3. Page-specific sections.
4. Large legacy modules such as `AnimeHero.module.css`.

Compatibility aliases beginning with `--ui-` remain temporarily and should not be used in new code.
