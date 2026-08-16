# Agent Note: Configurable keep-alive timeout on the web server

Status: implemented

English | [中文](2026-08-16-webserver-keepalive-timeout.zh.md)

## Problem

Node's http server default `keepAliveTimeout` is 5000ms: after finishing a response, the server destroys a socket that receives no new request for five seconds. A browser holds pooled connections per origin and reuses one on the next action; when that action lands right around the destroy, the request hits a dead socket and the fetch fails (`failed to fetch` on remote LAN clients), recovering only once a fresh socket exists. This destroy/reuse race is the documented nodejs/node#27379 hazard, and it bit this deployment on both the direct `http://<lan-ip>:3080` path and (before the proxy-side fix) the 8443 TLS proxy path.

## Decision

The webserver plugin (`@deepseek-ai/dsh-host-webserver`) gains a validated `keepAliveTimeout` config field (milliseconds; default 60000; 0 disables the timeout), applied to the `node:http` server at creation. The 60s default shrinks the race window twelvefold over Node's default; deployments can tune or disable it through the webserver row in `cordis.patch.yml`.

## Verification

A raw-socket probe against the running GUI confirmed the server closed an idle keep-alive socket at ~6s (5s timeout plus request processing). The webserver REAL-composition spec adds two cases: the default boots to a `Keep-Alive: timeout=60` response header, and a configured 15000 boots to `timeout=15`. The full webserver suite passes.

## Alternatives considered

**Keep Node's 5s default and tune only the deployment.** Rejected: every deployment would hit the same race; a saner default fixes the class of failure.

**Set the option unconditionally in code.** Rejected by the repo rule that deployment-varying choices are validated Config fields, not hardcoded tunables.

## Consequences

Remote browsers' keep-alive connections live up to 60s idle instead of 5s, making the destroy/reuse race rare instead of common. The new config key is wired into the generated config catalog and the package README.
