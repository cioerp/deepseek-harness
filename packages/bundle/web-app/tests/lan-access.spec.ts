/** The LAN toggle's profile-patch host rewrite (`rewriteWebserverHost`). */
import { describe, expect, it } from 'vitest'
import { rewriteWebserverHost } from '../src/lan-access.ts'

const PATCH = `# Your patch layer for this dsh profile, applied after every bundle layer:
# a top-level YAML array of loader patch entries (id-targeted config
# overrides, disables, and insert lists; \`!!js\` expressions allowed).

# Bind the Web GUI to all interfaces so LAN devices can reach it.
- id: webserver
  config:
    host: '0.0.0.0'
    port: !!js ctx.webStartup.port ?? 3080
`

describe('rewriteWebserverHost', () => {
  it('flips the webserver host to loopback when disabling', () => {
    const next = rewriteWebserverHost(PATCH, false)
    expect(next).toContain("host: '127.0.0.1'")
    expect(next).not.toContain("host: '0.0.0.0'")
    // Comments and the port expression survive untouched.
    expect(next).toContain('# Bind the Web GUI to all interfaces')
    expect(next).toContain('port: !!js ctx.webStartup.port ?? 3080')
  })

  it('flips the webserver host back to all-interfaces when enabling', () => {
    const next = rewriteWebserverHost(rewriteWebserverHost(PATCH, false), true)
    expect(next).toContain("host: '0.0.0.0'")
    expect(next).not.toContain("host: '127.0.0.1'")
  })

  it('returns the input unchanged when the value already matches', () => {
    expect(rewriteWebserverHost(PATCH, true)).toBe(PATCH)
    const disabled = rewriteWebserverHost(PATCH, false)
    expect(rewriteWebserverHost(disabled, false)).toBe(disabled)
  })

  it('throws when the patch carries no webserver row', () => {
    expect(() => rewriteWebserverHost('# only a comment\n[]\n', true)).toThrow(/no webserver host line/)
  })

  it('throws when a webserver row has no host line', () => {
    expect(() => rewriteWebserverHost('- id: webserver\n  config:\n    port: 3080\n', true)).toThrow(/no webserver host line/)
    // A following entry closes the webserver block before any host line.
    expect(() => rewriteWebserverHost('- id: webserver\n  config:\n    port: 3080\n- id: other\n', true)).toThrow(/no webserver host line/)
  })

  it('profilePatchPath falls back to the home directory without DSH_HOME', () => {
    const previous = process.env.DSH_HOME
    delete process.env.DSH_HOME
    try {
      expect(profilePatchPath()).toContain(join('profiles', 'web', 'cordis.patch.yml'))
    } finally {
      if (previous === undefined) delete process.env.DSH_HOME
      else process.env.DSH_HOME = previous
    }
  })
})

import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Context } from '@deepseek-ai/cordis'
import { profilePatchPath, registerLanAccess } from '../src/lan-access.ts'

const FLIP_PATCH = `- id: webserver
  config:
    host: '0.0.0.0'
    port: !!js ctx.webStartup.port ?? 3080
`

describe('registerLanAccess', () => {
  async function mount(home: string, host: '0.0.0.0' | '127.0.0.1') {
    const previous = process.env.DSH_HOME
    process.env.DSH_HOME = home
    const ctx = new Context()
    let watcher: ((next: { lanAccess: boolean }) => void) | undefined
    ctx.provide('settings', {
      register: () => ({
        get: () => ({ lanAccess: true }),
        watch: (cb: (next: { lanAccess: boolean }) => void): (() => void) => {
          watcher = cb
          return () => {}
        },
        update: async () => {},
        replace: async () => {},
      }),
    } as never)
    ctx.provide('webServer', { host } as never)
    await ctx.plugin({ inject: ['settings', 'webServer'], apply: (c) => { registerLanAccess(c) } }).await()
    return { trigger: (next: { lanAccess: boolean }): void => {
      if (watcher === undefined) throw new Error('watcher not registered')
      watcher(next)
    }, restore: () => {
      if (previous === undefined) delete process.env.DSH_HOME
      else process.env.DSH_HOME = previous
    } }
  }

  it('rewrites the profile patch when the namespace flips, and no-ops when unchanged', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'dsh-lan-'))
    const previous = process.env.DSH_HOME
    process.env.DSH_HOME = dir
    try {
      mkdirSync(join(dir, 'profiles', 'web'), { recursive: true })
      const patchPath = profilePatchPath()
      writeFileSync(patchPath, FLIP_PATCH)
      const { trigger, restore } = await mount(dir, '0.0.0.0')
      try {
        // Unchanged value: no write.
        trigger({ lanAccess: true })
        await new Promise(resolve => setTimeout(resolve, 30))
        expect(readFileSync(patchPath, 'utf8')).toContain("host: '0.0.0.0'")
        // Flip: the patch host becomes loopback.
        trigger({ lanAccess: false })
        await new Promise(resolve => setTimeout(resolve, 50))
        expect(readFileSync(patchPath, 'utf8')).toContain("host: '127.0.0.1'")
        // Already at the target: no rewrite, no write.
        trigger({ lanAccess: false })
        await new Promise(resolve => setTimeout(resolve, 30))
        expect(readFileSync(patchPath, 'utf8')).toContain("host: '127.0.0.1'")
      } finally {
        restore()
      }
    } finally {
      if (previous === undefined) delete process.env.DSH_HOME
      else process.env.DSH_HOME = previous
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('logs and keeps going when the patch has no webserver host line', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'dsh-lan-'))
    try {
      const patchPath = profilePatchPath()
      writeFileSync(patchPath, '# nothing here\n[]\n')
      const { trigger, restore } = await mount(dir, '0.0.0.0')
      try {
        trigger({ lanAccess: false })
        await new Promise(resolve => setTimeout(resolve, 50))
        expect(readFileSync(patchPath, 'utf8')).toContain('# nothing here')
      } finally {
        restore()
      }
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
