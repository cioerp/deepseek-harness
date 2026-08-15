/**
 * LAN-access toggle: a `network.lanAccess` settings namespace that rewrites
 * the webserver `host` in the web profile's own `cordis.patch.yml`. The
 * profile layer's config-only HMR re-applies the webserver row, which rebinds
 * the socket — the same live path a manual patch edit takes.
 * @module
 */

import { readFile, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
// Type-only: the settings service is reached through `ctx.settings` and the
// `'settings'` inject name, so the bundle needs no runtime link to the
// settings package; the branded namespace literal is the wire contract.
import type { SettingsNamespace } from '@deepseek-ai/dsh-settings'
import type {} from '@deepseek-ai/dsh-settings'

/** The webserver schema's all-interfaces bind literal (mirror of index.ts). */
const ALL_INTERFACES_HOST = '0.0.0.0'
/** Loopback fallback the bundle patch defaults to when no host flag is named. */
const LOOPBACK_HOST = '127.0.0.1'

/** Settings namespace owning the LAN toggle. */
export const LAN_NAMESPACE = 'network' as SettingsNamespace

/** The toggle's section shape. */
export interface LanConfig {
  /** Serve the GUI on all interfaces (LAN reachable). */
  lanAccess: boolean
}

/**
 * Absolute path of the web profile's own patch layer.
 * @param home - dsh home; defaults to `DSH_HOME` or `~/.dsh`.
 * @returns the profile patch path.
 */
export function profilePatchPath(home = process.env.DSH_HOME ?? join(homedir(), '.dsh')): string {
  return join(home, 'profiles', 'web', 'cordis.patch.yml')
}

/**
 * Flip the webserver `host` value in the profile patch text. Only the host
 * line under the `- id: webserver` entry is touched, so comments and the
 * port expression survive; everything else stays byte-identical.
 * @param text - the patch file's current text.
 * @param enabled - `0.0.0.0` when true, `127.0.0.1` when false.
 * @returns the next patch text, or the input unchanged when the value already matches.
 * @throws when the patch carries no webserver row with a `host` line — the
 * toggle cannot apply to a patch that does not declare one.
 */
export function rewriteWebserverHost(text: string, enabled: boolean): string {
  const lines = text.split('\n')
  const host = enabled ? ALL_INTERFACES_HOST : LOOPBACK_HOST
  let inWebserver = false
  for (const [index, line] of lines.entries()) {
    if (line.trim() === '- id: webserver') { inWebserver = true; continue }
    if (inWebserver && /^-\s+id:/.test(line.trim())) break
    if (inWebserver && /^\s*host:/.test(line)) {
      if (line.includes(`'${host}'`)) return text
      const next = [...lines]
      next[index] = line.replace(/host:.*/, `host: '${host}'`)
      return next.join('\n')
    }
  }
  throw new Error('web-app: no webserver host line in the profile patch; the LAN toggle cannot apply')
}

/**
 * Register the LAN toggle namespace and apply committed changes to the
 * profile patch. The webserver row's host flips between `0.0.0.0` and
 * `127.0.0.1`; the profile's config-only HMR re-applies the row and rebinds
 * the socket. A write that fails (patch unreadable, row absent) is contained
 * and logged — the toggle's stored value simply does not take effect.
 * @param ctx - plugin context carrying `webServer` and the `settings` service.
 */
export function registerLanAccess(ctx: Context): void {
  const initial = ctx.webServer.host === ALL_INTERFACES_HOST
  ctx.inject(['settings'], (sctx) => {
    const scope = sctx.settings.register<LanConfig>(LAN_NAMESPACE, z.object({
      lanAccess: z.boolean().default(initial),
    }))
    scope.watch(async (next) => {
      if (next.lanAccess === (ctx.webServer.host === ALL_INTERFACES_HOST)) return
      try {
        const path = profilePatchPath()
        const text = await readFile(path, 'utf8')
        const rewritten = rewriteWebserverHost(text, next.lanAccess)
        if (rewritten !== text) await writeFile(path, rewritten)
      } catch (error) {
        ctx.logger.warn('web-app: LAN toggle failed to apply')
        ctx.logger.warn(error)
      }
    })
  })
}
