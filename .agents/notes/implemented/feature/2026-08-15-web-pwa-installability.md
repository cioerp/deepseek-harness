# Agent Note: Installable PWA (icons, manifest, pass-through service worker)

Status: implemented

English | [中文](2026-08-15-web-pwa-installability.zh.md)

## Problem

The web GUI had a manifest with only an SVG icon and no service worker, so mobile browsers could not install it as an app; iOS fell back to a screenshot icon.

## Decision

Add PNG app icons (192/512 + maskable + apple-touch-icon), fill out the manifest (theme/background color), and register a pass-through service worker. The worker only handles static GETs: `/api/*` and every non-GET bypass it entirely, because a fetch-through SW that claims every request becomes a failure point — POST RPCs forwarded through it fail with network errors, which silently breaks the GUI's live traffic.

## Verification

Built frontend serves the new assets; the sw.js in the dist excludes /api. Browser smoke: the GUI remains functional with the worker active.

## Alternatives considered

**Cache-first worker.** Rejected: bundles carry content-hash revs and sessions stream live; caching can only serve stale code.

## Consequences

The GUI is installable on Android Chrome and iOS home screen. The service worker is a no-op for all API traffic, so it cannot regress the harness.
