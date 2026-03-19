# Shift Calendar Redesign

**Date:** 2026-03-19
**Status:** Approved
**Scope:** `src/app/shifts/page.tsx` + `src/components/dashboard/ShiftCalendar.tsx`

---

## Context

The team runs 24/7 support operations with multiple agents per hour. Currently shifts are managed in an Excel file (rows = hour slots 00–23, columns = days with multiple agent sub-columns). The goal is to **replace the Excel entirely** with the dashboard as the primary shift management tool.

The current dashboard has usability issues:
- Controls (upload, Google Calendar, handover, workload summary) are scattered in a sidebar inside the grid component
- No way to assign multiple agents to the same time range in a single action
- No weekly workload summary visible at a glance
- No "clear week" action
- No "Today" shortcut

---

## Design

### Layout: Option A — Full-width toolbar + agent bar + grid

The page is structured top-to-bottom with no right sidebar:

```
[ Toolbar ]
[ Agent bar ]
[ Grid (full width, scrollable vertically) ]
```

The right column (`LiveWorkload` + `WelcomePanel`) is removed from the shifts page — that information is now surfaced in the agent bar.

---

### ① Toolbar

A single horizontal bar containing all controls:

```
‹  17 – 23 Mar 2026  ›  [Hoy]  |  [🗑 Limpiar semana]  |  [📅 Google Cal]  [+ Entrega de Turno]
```

- **Navigation**: prev/next week arrows + week date range label
- **Hoy**: jumps to the current week
- **Limpiar semana**: deletes all assignments for the visible week, guarded by a confirmation dialog (`AlertDialog`)
- **Google Cal**: opens `GoogleCalendarSettings` (existing component)
- **Entrega de Turno**: opens `HandoverDialog` (existing component)

`UploadShiftsDialog` is removed — no CSV import needed.

---

### ② Agent bar

A horizontal strip below the toolbar showing all agents who have assignments in the current week, with their total hours:

```
Semana:  [Edwin 40h]  [Santiago 38h]  [Mykol 35h]  [Omar 24h]  [Arturo 21h]  [Jhoinner 52h ⚠]
```

- Each agent chip uses their consistent color (same color system as the grid chips)
- If an agent exceeds **45 hours** in the week, their chip turns red with a `⚠` warning
- Chips are computed from `assignments` state — no extra fetch needed
- Shows only agents who have ≥1 assignment this week

---

### ③ Grid

Full-width, 24 rows (hours 00–23) × 7 columns (Mon–Sun). All hours are equal height (`h-[40px]`) — the operation is 24/7.

**Interaction — drag to select a range:**
1. `mousedown` on a cell → start selection, record `{ date, hour }`
2. `mouseenter` while dragging → extend selection highlight (green tint)
3. `mouseup` → open assignment dialog with the selected range
4. `Escape` key → cancel selection

**Cell content:**
- Each assigned agent shows as a colored chip: `[Name ✕]`
- Clicking `✕` deletes that specific assignment (existing behavior, kept)
- The `✕` is the only interactive element on the chip — clicking elsewhere on the cell does not trigger deletion

**Column highlight:** Today's column has a subtle green tint header underline + background tint.

---

### ④ Assignment dialog

Opens after releasing the mouse on a selection. Shows the selected date/range and all registered users as colored buttons.

```
Asignar agente
Lunes 17 · 07:00 – 09:00

[Edwin]  [Santiago]  [Mykol]  [Omar]  [Arturo]  [Gabriel]  [Jhoinner]  [Urrego ✓]

                                                           [Cancelar]  [Asignar]
```

- **Multi-select**: clicking a button toggles it selected/deselected (green fill when selected)
- **Assign**: creates one `saveSupportAssignment` call per selected agent × per hour in the range
- Agent buttons use the same consistent color system as the grid chips
- The dialog replaces the current single-agent input field approach

---

## What Changes

### Removed
- `UploadShiftsDialog` component usage in shifts page and inside `ShiftCalendar`
- Sidebar cards inside `ShiftCalendar` (Carga Semanal, Entrega de Turno, Google Calendar, Upload)
- `LiveWorkload` + `WelcomePanel` from `shifts/page.tsx` right column
- The `lg:grid-cols-[1fr_280px]` layout in `shifts/page.tsx`

### Added
- Agent bar (horizontal chips with weekly hours + overload warning)
- "Hoy" button in toolbar
- "Limpiar semana" button with `AlertDialog` confirmation
- Multi-agent selection in the assignment dialog

### Kept
- `HandoverAlert` + `HandoverDialog` (moved to toolbar)
- `GoogleCalendarSettings` (moved to toolbar)
- Drag-to-select range interaction (already implemented, preserved)
- Delete via `✕` button on agent chip (already fixed, preserved)
- Consistent agent color system (`AGENT_COLOR_CLASSES` + `getAgentColor`)

---

## Files Affected

| File | Change |
|------|--------|
| `src/app/shifts/page.tsx` | Full rewrite: remove right column, restructure layout, add toolbar buttons |
| `src/components/dashboard/ShiftCalendar.tsx` | Full rewrite: remove sidebar, add agent bar, update dialog for multi-select |

No new API routes or Prisma schema changes needed.

---

## Out of Scope

- Excel direct import (the team will use the dashboard as primary tool going forward)
- Recurring shift templates
- Drag-to-move existing assignments
