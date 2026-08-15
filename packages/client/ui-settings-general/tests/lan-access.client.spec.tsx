// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { Context } from '@deepseek-ai/cordis'
import { SlotRegistry, createSnapshotStore } from '@deepseek-ai/dsh-client-runtime/client'
import { apply, inject } from '@deepseek-ai/dsh-client-ui-settings-general/client'
import { LanAccessRow, type LanAccessRowProps } from '../src/client/LanAccessRow.tsx'
import { zh } from '../src/client/locales.ts'

// The standard props share the shell never reads; stub them as never-called.
const neverHook = (() => { throw new Error('row must not read global hooks') }) as never

afterEach(() => { cleanup() })

const t: LanAccessRowProps['t'] = key => (zh as Record<string, string>)[key] ?? key

function mountRow(value: boolean, setLanAccess = vi.fn()) {
  const store = createSnapshotStore(value)
  return {
    setLanAccess,
    view: render(
      <LanAccessRow
        useSessions={neverHook}
        useWorkspaces={neverHook}
        useLanAccess={sel => sel(store.getSnapshot())}
        setLanAccess={setLanAccess}
        t={t}
      />,
    ),
  }
}

describe('LanAccessRow', () => {
  it('renders the switch reflecting the current value and commits the opposite', () => {
    const b = mountRow(true)
    const toggle = b.view.getByRole('switch')
    expect(toggle.getAttribute('aria-checked')).toBe('true')
    fireEvent.click(toggle)
    expect(b.setLanAccess).toHaveBeenCalledWith(false)
  })

  it('renders off when LAN access is disabled', () => {
    const b = mountRow(false)
    expect(b.view.getByRole('switch').getAttribute('aria-checked')).toBe('false')
  })
})

describe('LanAccessRow wiring', () => {
  it('the apply-registered row writes the network namespace through the scope', async () => {
    const ctx = new Context()
    await ctx.plugin(SlotRegistry).await()
    ctx.provide('locale', {
      register: () => () => {},
      bind: () => (key: string) => key,
      getSnapshot: () => ({ active: 'zh', locales: [], revision: 0 }),
      subscribe: () => () => {},
    } as never)
    const setCalls: unknown[] = []
    ctx.provide('settingsScope', {
      bind: () => ({
        getSnapshot: () => ({
          status: 'ready' as const, value: { lanAccess: true }, base: undefined,
          user: undefined, revision: 1, writable: true, mode: 'host' as const,
        }),
        subscribe: () => () => {},
        load: async () => {},
        set: async (field: string, value: unknown) => { setCalls.push([field, value]) },
        unset: async () => {},
        dispose: async () => {},
      }),
    } as never)
    ctx.provide('connection', { api: {}, isLoopback: true } as never)
    ctx.provide('remote', { $on: () => () => {} } as never)
    const slots = ctx.get('slots') as unknown as SlotRegistry
    slots.register(
      {
        name: 'root',
        children: {
          'settings.trigger': { kind: 'single', scope: 'root' },
          'settings.header': { kind: 'single', scope: 'root' },
          'settings.action': { kind: 'list', scope: 'root' },
          'settings.close': { kind: 'single', scope: 'root' },
          'settings.section': { kind: 'list', scope: 'root' },
        },
      } as never,
      () => null,
    )
    await ctx.plugin({ inject: [...inject], apply }).await()
    const entry = slots.entries('settings.general.item').find(e => e.options.id === 'lan-access')!
    const injected = (entry.inject as () => {
      setLanAccess(enabled: boolean): void
      hooks: { lanAccess: { getSnapshot(): boolean } }
    })()
    // The row store adopts the scope's resolved value (true here).
    expect(injected.hooks.lanAccess.getSnapshot()).toBe(true)
    injected.setLanAccess(false)
    expect(setCalls).toEqual([['lanAccess', false]])
  })
})
