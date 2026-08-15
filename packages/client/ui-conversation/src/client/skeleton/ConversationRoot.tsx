// Resident conversation skeleton. Hero chrome, composer positioning, the
// chain, AND the composer bar (session-maybe slot) stay mounted across
// no-session/session transitions — the bar renders inert via owner props.

import { useCallback, useEffect, useRef, useState, type UIEvent } from 'react'
import clsx from 'clsx'
import type { WorkspaceId } from '@deepseek-ai/dsh-client-runtime/client'
import type { ConversationSlotProps, InputZone } from '../contract/slots.ts'
import { HeroGlow, HeroShell, WorkspaceChip, workspaceLabel } from './EmptyHero.tsx'
import css from './ConversationRoot.module.css'

/** Full props composed from the slot contract. */
export type ConversationRootProps = ConversationSlotProps

export function ConversationRoot({
  sessionId, useSession, useSessions, useWorkspaces, useInput, useComposerBlock,
  renderSlot, renderSlotChain, selectWorkspace, t,
}: ConversationRootProps) {
  const openState = useSession(s => s.openState)
  const composerPhase = useSession(s => s.composerPhase)
  const pending = useSession(s => s.pending) ?? []
  const session = useSession(s => s)
  const inputState = useInput(s => s)
  const cwd = useSessions(s => sessionId === undefined ? undefined : s.byId[sessionId]?.cwd)
  const summaryBlank = useSessions(s => sessionId === undefined ? undefined : s.byId[sessionId]?.blank)
  const workspaces = useWorkspaces(s => s)
  // A plugin this package cannot import (ui-model-selection) says this session cannot
  // send; its reason is already localized by whoever raised it.
  const composerBlock = useComposerBlock(block => block)

  const [pickerOpen, setPickerOpen] = useState(false)
  const [pendingWorkspaceId, setPendingWorkspaceId] = useState<WorkspaceId | undefined>()
  const pickerAnchor = useRef<HTMLButtonElement>(null)

  // Publishes the seat's live height as --dsh-composer-height on the scroll
  // body so floating controls (ChatView back-to-bottom) clear the composer as
  // it grows. Callback ref, not an effect; stable identity prevents observer
  // churn while the first blank session fills the resident body outlet.
  const seatObserver = useRef<ResizeObserver | null>(null)
  const seatResizeRef = useCallback((seat: HTMLDivElement | null): void => {
    seatObserver.current?.disconnect()
    seatObserver.current = null
    const scroller = seat?.parentElement ?? null
    if (seat === null || scroller === null) return
    seatObserver.current = new ResizeObserver(() => {
      scroller.style.setProperty('--dsh-composer-height', `${seat.offsetHeight}px`)
    })
    seatObserver.current.observe(seat)
  }, [])

  // Narrow reading mode: while the user is scrolled up and the input is
  // unfocused, the composer seat yields to the transcript (one-tap reveal).
  const [isNarrow, setIsNarrow] = useState(() =>
    typeof window.matchMedia === 'function' ? window.matchMedia('(max-width: 1023px)').matches : false)
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const query = window.matchMedia('(max-width: 1023px)')
    const onChange = (event: MediaQueryListEvent): void => { setIsNarrow(event.matches) }
    query.addEventListener('change', onChange)
    return () => { query.removeEventListener('change', onChange) }
  }, [])
  const scrollerEl = useRef<HTMLDivElement | null>(null)
  const seatRef = useCallback((seat: HTMLDivElement | null): void => {
    seatEl.current = seat
    scrollerEl.current = seat?.parentElement ?? null
    seatResizeRef(seat)
  }, [seatResizeRef])
  const [scrolledUp, setScrolledUp] = useState(false)
  // The sidebar's bottom bar (narrow + collapsed) reveals the composer through
  // this window event — a documented cross-package string contract, like the
  // `data-conversation-scroll` attribute.
  const [revealed, setRevealed] = useState(false)
  const seatEl = useRef<HTMLDivElement | null>(null)
  // Live hidden-state mirror for the scroll handler's hysteresis: the handler
  // must decide from the latest flip without waiting for a re-render.
  const scrolledUpRef = useRef(false)
  const onScroll = (event: UIEvent<HTMLDivElement>): void => {
    const el = event.currentTarget
    // Distance to the TRANSCRIPT end, not the scroller end: subtracting the
    // seat's own height keeps the measure invariant to the seat appearing or
    // disappearing, so showing the composer cannot flip the threshold and
    // cascade into the flicker a raw scrollHeight check would cause.
    const seatHeight = seatEl.current?.offsetHeight ?? 0
    const dist = el.scrollHeight - seatHeight - el.scrollTop - el.clientHeight
    const prev = scrolledUpRef.current
    // Hysteresis: a 40..120px dead zone absorbs slow-scroll jitter at the edge.
    const next = prev ? dist < 40 ? false : prev : dist > 120
    if (next === prev) return
    scrolledUpRef.current = next
    setScrolledUp(next)
    // Scrolling up is a reading gesture: drop the keyboard with the composer.
    if (next) el.querySelector('textarea')?.blur()
  }
  const revealComposer = useCallback((): void => {
    setRevealed(true)
    const scroller = scrollerEl.current
    if (scroller === null) return
    if (typeof scroller.scrollTo === 'function') scroller.scrollTo({ top: scroller.scrollHeight })
    scroller.querySelector('textarea')?.focus()
  }, [])
  // Latest hidden state for the toggle handler: read through a ref so the
  // callback (declared before the derivation) never touches the const early.
  const composerHiddenRef = useRef(false)
  const toggleComposer = useCallback((): void => {
    // The bottom bar button is a switch: reveal when hidden, hide when shown
    // (blur so the mobile keyboard closes with the composer).
    if (composerHiddenRef.current) {
      revealComposer()
    } else {
      setRevealed(false)
      scrollerEl.current?.querySelector('textarea')?.blur()
    }
  }, [revealComposer])
  useEffect(() => {
    const onToggleEvent = (): void => { toggleComposer() }
    window.addEventListener('dsh.composer.toggle', onToggleEvent)
    return () => {
      window.removeEventListener('dsh.composer.toggle', onToggleEvent)
    }
  }, [toggleComposer])

  const sessionWorkspace = sessionId === undefined
    ? undefined
    : workspaces.items.find(workspace => workspace.sessionIds.includes(sessionId))
  const pendingWorkspace = workspaces.items.find(
    workspace => workspace.workspaceId === pendingWorkspaceId,
  )

  // Clear the pending pick once the session lands in it, or when the picked
  // workspace disappears from a ready list (deleted from the sidebar).
  useEffect(() => {
    if (pendingWorkspaceId === undefined) return
    if (sessionWorkspace?.workspaceId === pendingWorkspaceId
      || (workspaces.phase === 'ready' && pendingWorkspace === undefined)) {
      setPendingWorkspaceId(undefined)
    }
  }, [pendingWorkspaceId, sessionWorkspace?.workspaceId, workspaces.phase, pendingWorkspace])

  // While a session is still replaying (loading + blank) the hero/docked
  // choice is unknowable — render the composer hidden instead of flashing
  // the centered hero and snapping to the docked bar (or vice versa).
  // Exemption: a session the list summary already proves blank can only
  // land on the hero, so hiding would blank the column for the whole
  // history round-trip (the startup auto-selection flash) for nothing.
  // The exemption is deliberately open-state-wide, not loading-only: a
  // summary-blank session is the hero before its open starts (`cold`) and
  // after one fails (`error`) for the same reason — there is no history.
  const settling = sessionId !== undefined && composerPhase === 'blank' && openState === 'loading'
    && summaryBlank !== true
  const hero = sessionId === undefined
    || (composerPhase === 'blank' && (openState === 'open' || summaryBlank === true))
  const zone: InputZone | undefined =
    session === undefined || inputState === undefined ? undefined : { session, input: inputState }

  // The chip is a selector; label resolution walks the flow top-down:
  //   1. a just-picked workspace (pending) → its title;
  //   2. cold start, no session yet → placeholder ("Choose workspace");
  //   3. the blank session's workspace is in the list → its title;
  //   4. list still loading → cwd folder name bridges so the title does not
  //      flash on refresh (empty cwd → placeholder);
  //   5. list ready but no owning workspace (deleted from the sidebar) →
  //      placeholder, never the deleted folder's name via cwd.
  const chipTitle = pendingWorkspace?.title
    ?? (sessionId === undefined
      ? undefined
      : sessionWorkspace?.title
        ?? (workspaces.phase === 'ready' || cwd === undefined || cwd === ''
          ? undefined
          : workspaceLabel(cwd)))

  const heroWorkspaceRow = (
    <div className={css.heroWorkspaceRow}>
      <WorkspaceChip
        buttonRef={pickerAnchor}
        label={chipTitle}
        menuOpen={pickerOpen}
        onClick={() => { setPickerOpen(open => !open) }}
        t={t}
      />
      {renderSlot('conversation.hero.workspace', {
        open: pickerOpen,
        anchorRef: pickerAnchor,
        selectedId: pendingWorkspaceId ?? sessionWorkspace?.workspaceId,
        onPick: (workspaceId) => {
          setPickerOpen(false)
          setPendingWorkspaceId(workspaceId)
          void selectWorkspace(workspaceId).catch(() => {
            setPendingWorkspaceId(current => current === workspaceId ? undefined : current)
          })
        },
        onClose: () => { setPickerOpen(false) },
      })}
      {renderSlot('conversation.hero.agentPreset', {})}
    </div>
  )

  // The placeholder chip ("Choose workspace") and the Workspace-trigger input travel
  // together: no workspace picked yet (cold start, no session at all), or a
  // blank session whose workspace vanished (deleted from the sidebar). The
  // bar is ONE session-maybe slot rendered unconditionally — inert is a prop,
  // not a different tree, so the textarea DOM survives the transition.
  const inert = sessionId === undefined || (hero && chipTitle === undefined)
  // A raised block is the same inert posture with the blocker's own reason:
  // one disabled textarea, never a second tree. The no-workspace state wins
  // when both hold — picking a workspace is the earlier prerequisite.
  const blocked = !inert && composerBlock !== undefined
  const inputBar = renderSlot('conversation.composer.bar', {
    variant: hero ? 'hero' : 'composer',
    ...(inert
      ? {
        disabled: true,
        placeholder: t('placeholder.workspace'),
        workspacePickerOpen: pickerOpen,
        onRequestWorkspace: () => { setPickerOpen(true) },
      }
      : blocked
        // `blocked`, not `disabled`: the bar refuses input either way, but a
        // block keeps the model seat live because choosing a model is how the
        // user clears it.
        ? { blocked: composerBlock, placeholder: composerBlock.reason }
        : hero ? { placeholder: t('placeholder.hero') } : {}),
    overlay: renderSlot('conversation.input.overlay', {}),
    leftItems: zone === undefined ? null : renderSlot('conversation.input.left', zone),
    rightItems: zone === undefined ? null : renderSlot('conversation.input.right', zone),
    // Stats band under the card, inside the bar's width column so both
    // share one constraint (composer.dock = stats-line family).
    footer: !hero && zone !== undefined ? renderSlot('conversation.composer.dock', zone) : null,
  })

  const composerBar = (
    <div className={clsx(css.composerStack, hero && css.composerHero)}>
      {hero && <HeroGlow className={css.heroGlow} />}
      {hero && <HeroShell t={t} renderSlot={renderSlot} />}
      {hero && heroWorkspaceRow}
      {zone !== undefined && renderSlot('conversation.input.dock', zone)}
      {inputBar}
    </div>
  )

  const phase = settling ? 'settling' : hero ? 'hero' : 'active'
  // Narrow reading mode: the composer stays out of the way by default —
  // hidden until the bottom bar reveals it, then again while the user scrolls
  // up. Interaction overlays (pending) must always stay visible.
  const composerHidden = isNarrow && phase === 'active' && pending.length === 0
    && (scrolledUp || !revealed)
  composerHiddenRef.current = composerHidden
  const composer = renderSlotChain(
    'conversation.composer',
    { interactions: pending, session },
    { fallback: composerBar, overlay: true },
  )

  // Sticky wraps the whole chain output (fallback + elected overlay), not
  // only `.composerStack`: overlay:true renders those as siblings, and sticky
  // on the fallback alone would leave Question/Approval panels at the content
  // end off-screen when the user is not pinned to the floor.
  const composerSeat = (
    <div ref={seatRef} className={css.composerSeat} data-composer-seat="">
      {composer}
    </div>
  )

  return (
    <div className={css.root} data-phase={phase} data-composer-hidden={composerHidden || undefined}>
      {renderSlot('conversation.session.header', {})}
      <div className={css.scrollBody} data-conversation-scroll="" onScroll={onScroll}>
        {renderSlot('conversation.session', {})}
        {composerSeat}
      </div>
    </div>
  )
}
