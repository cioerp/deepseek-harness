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
})
