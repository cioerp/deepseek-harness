# Agent Note: Tooltip dismissal on scroll and outside pointer press

Status: implemented

English | [中文](2026-08-16-tooltip-scroll-dismissal.zh.md)

## Problem

The composer bar's action buttons (send, stop, commands) carry hover/focus tooltips. The bubble is `position: fixed` and escapes ancestor clipping, and it hides only on `mouseleave` or `blur`. On touch devices a tap synthesizes `mouseenter` but never fires `mouseleave`, and the narrow composer collapses to `visibility: hidden` while the user scrolls up — so after sending a message and scrolling to read, the bubble kept floating above the transcript until the next focus change.

## Decision

`Tooltip` (ui-primitives) now dismisses a visible bubble on any scroll event (window, capture phase, passive) or on a pointer press that lands outside the anchor. Both checks run on the raw event, so they do not race the React render that collapses the composer. A press on the anchor itself keeps the bubble (a press precedes the click). Dismissal is one-shot, not sticky: a fresh hover or focus re-shows it.

## Verification

`tooltip.client.spec.tsx` adds: scroll dismissal followed by re-show on a fresh hover, outside-pointer dismissal, and anchor-press keeps the bubble. The ui-primitives suite (501 tests) and the full `test:gui` suite (3765 tests) pass. The client bundle is rebuilt; the dev HMR chain re-hashes and hot-swaps the served bundle.

## Alternatives considered

**Thread a `disabled` prop from the composer.** Rejected: the hidden state is a CSS attribute on an ancestor (`data-composer-hidden`); plumbing it into InputBar's slot props would couple the shared Tooltip to the composer's collapse state.

**Hide when the anchor's computed `visibility` is hidden.** Rejected: the check must run after React commits the collapsing class, which races the scroll event that triggers the collapse.

## Consequences

Tooltips follow standard dismissal semantics (scroll / click-away) on every input device, fixing the floating-bubble-over-transcript on phones without changing desktop hover behavior.
