# Pulse 360 Dashboard - Air Traffic Control System

## Direction & Feel
**Intent:** For the coordinator focused on dispatching. A reactive interface where the physical state alters components. Live, high-contrast, designed for immediate action.
**Vibe:** Dynamic dark mode with warm blue-grays. Heavy use of elevation texturing to denote urgency. Thick focus rings and immediate micro-interactions (no bouncing).
**Signature:** "The Pulse Bar" — A 2px environmental top border that changes from cool blue to amber or intense red based on real-time SLA health, giving a "room read" before a single number is seen.

## Primitives & Tokens
### Surfaces
Base: `#14171E` (oklch 0.22 0.02 245) - Deep warm blue-gray canvas.
Layer 1 (Card): `#1E222A` (oklch 0.28 0.02 245) - Standard content surface.
Layer 2 (Popover/Hover): `#272B35` (oklch 0.35 0.02 245) - Elevated interactive elements.

### Text Hierarchy
Primary: `#F8FAFC` (oklch 0.98 0 0) - Crisp white for data and headlines.
Secondary: `#94A3B8` (oklch 0.70 0.02 245) - Muted gray for labels and structural info.
Tertiary: `#64748B` (oklch 0.55 0.02 245) - Deep gray for metadata and borders.

### Accents & Semantics
Signal (Brand/Info): `#3B82F6` (oklch 0.60 0.15 250) - Active, electric blue.
Alert (Warning): `#F59E0B` (oklch 0.75 0.18 80) - Urgent amber.
Critical (Destructive): `#EF4444` (oklch 0.60 0.20 25) - Immediate action red.
Success: `#10B981` (oklch 0.65 0.15 150) - Stable green.

## Depth Strategy (Layered Shadows/Borders)
- **Separation:** Soft borders `rgba(255,255,255,0.06)` combined with 2px radius.
- **Elevation:** Shadows are dark and tight (`0 4px 12px rgba(0,0,0,0.5)`). They don't spread much, keeping the UI looking dense and grounded.
- **Focus:** 2px solid ring using the `Signal` color, with a 2px offset.

## Spacing & Sizing Base Unit
Base unit: `4px` (0.25rem).
Micro spacing: `4px` (gap-1).
Component internal: `12px` (p-3) or `16px` (p-4).
Section separation: `32px` (gap-8) or `48px` (gap-12).

## Typography Framework
**Headlines/UI Labels:** Geist Sans. Tight tracking (`-0.02em`).
**Data/Metrics:** Geist Mono. Used strictly for any numbers, tickets, or timestamps to ensure tabular alignment and technical aesthetic.

## Patterns to Build/Enforce
1. **The Pulse Bar**: A div at the absolute top of the viewport `h-[2px] w-full bg-signal transition-colors duration-1000`.
2. **Telemetry Tira (Strip)**: Metric "cards" should not be tall boxes, but rather wide strips where the metric is paired horizontally with a small density graph (sparkline).
3. **Severity Gradients**: Critical items in a list get a subtle `bg-gradient-to-r from-critical/10 to-transparent` instead of just a red dot.
4. **Immediate States**: `active:scale-[0.98]` on buttons without long transition durations. `transition-all duration-75` max for hover states.
