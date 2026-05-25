# ActByMe Design System — Cinematic Dark

This document describes the foundational design tokens and components for ActByMe's Cinematic Dark theme.

## Colors

- background: `#09090B`
- card: `#111827`
- border: `#1F2937`
- accent: `#6366F1`
- text (foreground): `#F9FAFB`
- muted: `#9CA3AF`

Use CSS variables declared in `apps/web/app/globals.css`.

## Typography

- System sans stack with `Inter` as preferred font.
- Headings: high contrast, larger sizes (2xl+ for hero), semi-bold.
- Body: 16px baseline, generous line-height (1.5) for readability.

## Spacing

- Use multiples of 4px (0.25rem) scale; base spacing tokens: 4,8,12,16,24,32.

## Buttons

- Primary: solid accent background, white text, subtle hover darker accent.
- Outline: transparent background, border in `border` token, text `foreground`.
- Ghost: minimal, text-only with hover surface.

## Cards

- Rounded corners (8px), subtle border using `border` token, background `card`.
- Use padding 16px inside cards and a soft shadow for depth.

## Video components

- Thumbnails use `aspect-video` and should be cropped for cinematic framing.
- Playback buttons are accent-colored and rounded.

## Actor profile layout

- Hero section with large avatar, display name, headline, and CTA actions.
- Profile metadata in a two-column responsive layout: left media, right details.

## Motion / action skills section

- Skill tiles animate subtly on hover (scale 1.02, short duration).
- Motion-heavy items should be optional and reduced for accessibility.

## Demo profile visual treatment

- Demo profiles must include a visible badge labeled “Demo profile”.
- Seed/demo data shown in UI must be non-deceptive and clearly marked.

## Accessibility

- Ensure color contrast ratios: 4.5:1 for body text, 3:1 for large display text.
