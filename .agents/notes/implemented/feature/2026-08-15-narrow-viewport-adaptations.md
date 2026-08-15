# Agent Note: Narrow-viewport adaptations (≤1023px)

Status: implemented

English | [中文](2026-08-15-narrow-viewport-adaptations.zh.md)

## Problem

The web GUI was designed for wide desktop columns: a fixed 748px chat column, a 56px collapsed sidebar rail eating horizontal space, a full session header, a permanently docked composer, and a 188px settings nav rail. On phones these consume scarce width and height for little value.

## Decision

A family of narrow-viewport adaptations, all keyed to the existing `1024` auto-collapse breakpoint:

- **Conversation column** becomes `clamp(748px, 72vw, 1200px)` — vw so every consumer of the shared width axis resolves one value, keeping the composer = content + 32px relation exact at every width.
- **Collapsed sidebar** leaves the CSS grid flow (track 0, conversation full width) and docks as a full-width bottom bar: toggle / new session / input / settings. The center column reserves its 56px strip so the composer sits above the bar and nothing is covered. The rail's workspace region yields (expand the sidebar to browse).
- **Session header** folds to a one-line title bar: mobile starts folded, desktop starts expanded and gains a fold button; the choice survives viewport changes.
- **Composer** stays collapsed by default on narrow screens; the bottom bar's Input pill toggles it through the documented `dsh.composer.toggle` window event. Scrolling away from the bottom hides it (and blurs, dropping the mobile keyboard); the scroll measure subtracts the seat's own height and uses a 40/120px hysteresis, so the fold cannot cascade into flicker.
- **Settings panel** becomes a top nav + content stack; chat side padding and user-bubble width tighten.

## Verification

Package suites: ui-conversation (header fold, composer auto-hide with stubbed scroll geometry and matchMedia), ui-layout (grid tracks and rail docking), ui-sidebar (bottom-bar toggle dispatch), ui-settings-general (mobile panel layout). All pass; the composer toggle contract is asserted on both sides of the window event.

## Alternatives considered

**Keep the rail in flow but overlay it.** Rejected: a vertical overlay covers transcript content; reserving its width wastes vertical space.

**Horizontal reorientation of the workspace rail.** Rejected: it would require restructuring ui-workspace's rail; hiding it while collapsed (expand to browse) is a smaller, safe trade.

**Raw scrollHeight threshold for the composer fold.** Rejected: the seat's own height fed back into the measure and produced a flicker loop at the boundary.

## Consequences

Mobile keeps full-width conversation and reading space; desktop behavior is unchanged except the optional header fold. The `dsh.composer.toggle` window event is a cross-package string contract like `data-conversation-scroll`. The collapsed workspace region is reachable only after expanding the sidebar.
