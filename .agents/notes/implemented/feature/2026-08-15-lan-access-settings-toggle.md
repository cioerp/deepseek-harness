# Agent Note: LAN access toggle in Settings

Status: implemented

English | [中文](2026-08-15-lan-access-settings-toggle.zh.md)

## Problem

LAN exposure was a manual edit: the webserver host lived as a literal in the user's `cordis.patch.yml`, flipped by editing the file. There was no in-product switch.

## Decision

The web bundle registers a `network.lanAccess` settings namespace (initial value from the actual bind). Its `watch` rewrites the webserver `host` line in the profile patch (`0.0.0.0` vs `127.0.0.1`) through a pure `rewriteWebserverHost`; the profile's config-only HMR re-applies the row and rebinds the socket, so the toggle takes effect live — the same path a manual patch edit takes. A Settings row in the general section switches the namespace through the standard settings scope (`set` on the scalar store, not `update`: the immer draft-mutator's return is discarded). The namespace joins the api-proxy `WEB_SETTINGS_NAMESPACES` allowlist, because registration alone does not expose a namespace to configuration clients (`settings-not-exposed`).

## Verification

Unit tests cover the patch rewrite (flip, idempotence, missing-row error) and the settings row (switch commit, store adoption). End-to-end: mutating the namespace via the loopback RPC flips the patch, the listener, and LAN reachability, while the HTTPS proxy (which forwards to loopback) keeps serving.

## Alternatives considered

**Make the webserver host read the namespace directly.** Rejected: row config is evaluated at activation, not on settings change; the patch rewrite reuses the existing HMR rebind instead of adding a rebind path.

## Consequences

LAN exposure is a first-class setting, operable from the host machine's loopback browser (the settings plane is loopback-only by design). The HTTPS proxy is unaffected in either state.
