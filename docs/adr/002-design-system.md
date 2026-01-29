# ADR-002: Design System Decisions

**Status:** Accepted  
**Date:** 2026-01-29  
**Author:** YardFlow Engineering Team

## Context

The YardFlow Hub application has grown organically with inconsistent UI patterns:
- Button styles vary (blue, purple, emerald)
- Modal close buttons in different positions
- Mixed icon libraries (lucide-react + inline SVGs)
- Inconsistent border radius values
- No documented color palette

This ADR establishes foundational design system decisions to ensure visual consistency.

## Decision

### Color Palette

#### Primary Colors
| Name | Value | Tailwind Class | Usage |
|------|-------|----------------|-------|
| Primary | `#2563EB` | `blue-600` | Primary actions, links |
| Primary Hover | `#1D4ED8` | `blue-700` | Primary action hover |
| Primary Light | `#DBEAFE` | `blue-100` | Primary backgrounds |

#### Semantic Colors
| Name | Value | Tailwind Class | Usage |
|------|-------|----------------|-------|
| Success | `#16A34A` | `green-600` | Success states, positive actions |
| Success Light | `#DCFCE7` | `green-100` | Success backgrounds |
| Warning | `#CA8A04` | `yellow-600` | Warning states |
| Warning Light | `#FEF9C3` | `yellow-100` | Warning backgrounds |
| Error | `#DC2626` | `red-600` | Error states, destructive actions |
| Error Light | `#FEE2E2` | `red-100` | Error backgrounds |

#### Neutral Colors
| Name | Value | Tailwind Class | Usage |
|------|-------|----------------|-------|
| Text Primary | `#374151` | `gray-700` | Primary text |
| Text Secondary | `#6B7280` | `gray-500` | Secondary text |
| Text Muted | `#9CA3AF` | `gray-400` | Placeholder, disabled text |
| Background | `#FFFFFF` | `white` | Page background |
| Surface | `#F9FAFB` | `gray-50` | Card backgrounds |
| Border | `#E5E7EB` | `gray-200` | Borders, dividers |

### Spacing Scale

```
xs: 0.25rem (4px)   - Tight spacing
sm: 0.5rem (8px)    - Compact spacing  
md: 1rem (16px)     - Default spacing
lg: 1.5rem (24px)   - Comfortable spacing
xl: 2rem (32px)     - Generous spacing
2xl: 3rem (48px)    - Section spacing
```

### Typography

| Element | Font | Weight | Size |
|---------|------|--------|------|
| Headings | Inter | 600 (semibold) | Variable |
| Body | Inter | 400 (regular) | 14px/16px |
| Labels | Inter | 500 (medium) | 12px |
| Mono | JetBrains Mono | 400 | Variable |

### Border Radius Scale

| Token | Value | Usage |
|-------|-------|-------|
| `rounded-ui-sm` | `0.25rem` (4px) | Badges, small elements |
| `rounded-ui-md` | `0.375rem` (6px) | Buttons, inputs |
| `rounded-ui-lg` | `0.5rem` (8px) | Cards, modals |
| `rounded-ui-xl` | `0.75rem` (12px) | Large panels |

### Focus States

All interactive elements MUST have visible focus states:

```css
.focus-ring {
  @apply focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500;
}
```

### Component Variants

#### Button Variants
| Variant | Background | Text | Border | Usage |
|---------|------------|------|--------|-------|
| Primary | `blue-600` | `white` | None | Primary actions |
| Secondary | `white` | `gray-700` | `gray-300` | Secondary actions |
| Danger | `red-600` | `white` | None | Destructive actions |
| Ghost | `transparent` | `gray-600` | None | Tertiary actions |

#### Button Sizes
| Size | Padding | Font Size | Min Height |
|------|---------|-----------|------------|
| sm | `px-3 py-1.5` | `text-sm` | 32px |
| md | `px-4 py-2` | `text-sm` | 40px |
| lg | `px-6 py-3` | `text-base` | 48px |

#### Modal Sizes
| Size | Max Width | Usage |
|------|-----------|-------|
| sm | `max-w-sm` (384px) | Confirmations |
| md | `max-w-md` (448px) | Forms |
| lg | `max-w-lg` (512px) | Complex forms |
| xl | `max-w-xl` (576px) | Multi-step wizards |

### Icon Standards

- **Library:** lucide-react (no inline SVGs for standard icons)
- **Small:** `w-4 h-4` (16px) - Inline with text
- **Medium:** `w-5 h-5` (20px) - Buttons, actions
- **Large:** `w-6 h-6` (24px) - Headers, empty states

## Migration Strategy

### Week 1: Modals First
All BulkXModal components migrate to shared `<Modal>` and `<Button>`

### Week 2: App.tsx Primary Actions
"Save", "Send Email", "Apply" buttons migrate to `<Button variant="primary">`

### Week 3: App.tsx Secondary Actions
"Cancel", "Back", filter buttons migrate to `<Button variant="secondary">`

### Rollback Criteria
If >3 visual regression failures in any migration batch, revert and reassess

## Consequences

### Positive
- Consistent visual language across the app
- Faster development with reusable components
- Better accessibility with standardized focus states
- Easier theming and dark mode implementation

### Negative
- Initial migration effort required
- Learning curve for new component APIs
- Potential visual regression during migration

### Risks Mitigated
- Visual regression: Covered by T61.0 visual regression tests
- Design debates: Documented decisions prevent bikeshedding
- Accessibility: Focus states mandated by design system

## Related ADRs
- ADR-001: Security Architecture

## References
- [Tailwind CSS Color Palette](https://tailwindcss.com/docs/customizing-colors)
- [WCAG 2.1 Focus Visible](https://www.w3.org/WAI/WCAG21/Understanding/focus-visible.html)
- [Lucide Icons](https://lucide.dev/icons/)
