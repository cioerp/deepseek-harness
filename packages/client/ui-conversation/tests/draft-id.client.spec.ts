import { describe, expect, it, vi } from 'vitest'
import { browserDraftId } from '../src/client/service.ts'

describe('browser draft ids', () => {
  it('mints a random hex id without requiring secure-context randomUUID', () => {
    // crypto.randomUUID is a secure-context Web API; the draft id must not
    // depend on it because the composer runs on plain-HTTP LAN origins too.
    vi.stubGlobal('crypto', {
      getRandomValues(bytes: Uint8Array) {
        return bytes.fill(0xab)
      },
    })
    try {
      expect(browserDraftId()).toMatch(/^draft-[0-9a-f]{16}$/)
    } finally {
      vi.unstubAllGlobals()
    }
  })
})
