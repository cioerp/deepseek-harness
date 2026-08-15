# Agent Note: RPC ids without a secure-context randomUUID

Status: implemented

English | [中文](2026-08-15-secure-context-free-rpc-ids.zh.md)

## Problem

The typed RPC client mints every `rpcId` with `crypto.randomUUID()`, a Web API browsers expose only in secure contexts (HTTPS or loopback). A deployment served over plain HTTP on a LAN address is not a secure context, so every typed call — directory picking, workspaces, sessions — threw `crypto.randomUUID is not a function` in the browser. The connection package already had a `getRandomValues`-backed fallback for its own generic RPC channel, but the typed `AbstractApiClient` path (the one the whole UI uses) was missed.

## Decision

One shared generator lives in the apiproxy `api` layer (`randomUuid`): it uses `crypto.randomUUID` when present and falls back to a `crypto.getRandomValues`-backed v4 otherwise. The fetch client's `mintRpcId` uses it, and the connection package's `client/random-uuid.ts` re-exports the same implementation instead of keeping a second copy. ui-conversation's browser draft attachment ids drop UUID shape for a `getRandomValues` hex id for the same reason (draft ids only need per-draft uniqueness).

## Verification

The apiproxy fetch-carrier spec gains a case that mints rpc ids with a `crypto` stub lacking `randomUUID`; ui-conversation gains a draft-id spec under the same stub. Both packages' suites pass.

## Alternatives considered

**Duplicate the fallback in each package.** Rejected: the repo's cross-file clone gate would flag a second UUID generator.

**Use the connection package's existing helper from apiproxy.** Rejected: dependency direction — connection depends on apiproxy.

## Consequences

Plain-HTTP LAN deployments can correlate RPCs; HTTPS and loopback keep using `crypto.randomUUID` unchanged. One UUID implementation remains, in the apiproxy api layer.
