/** General Settings row for the Web GUI's LAN reachability toggle. */
import clsx from 'clsx'
import type { SnapshotStore } from '@deepseek-ai/dsh-client-runtime/client'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { SettingsKey } from './locales.ts'
import css from './LanAccessRow.module.css'

/** Registration-side preference face. */
export interface LanAccessRowInjected {
  hooks: {
    /** Live switch position bound as useLanAccess. */
    lanAccess: SnapshotStore<boolean>
  }
  /** Commit one switch position to the `network` settings namespace. */
  setLanAccess: (enabled: boolean) => void
}

/** Full Settings-row props. */
export type LanAccessRowProps =
  PropsRuntime<'settings.general.item'>
  & PropsLocale<'settings'>
  & InjectFace<LanAccessRowInjected>

/**
 * Render the LAN access switch: toggling it flips the webserver host between
 * all-interfaces and loopback through the `network.lanAccess` namespace.
 * @param props - composed Settings slot props.
 * @returns the preference row.
 */
export function LanAccessRow({ useLanAccess, setLanAccess, t }: LanAccessRowProps) {
  const lanAccess = useLanAccess(value => value)

  return (
    <div className={css.row}>
      <div className={css.rowText}>
        <span className={css.title}>{t('lan.access' as SettingsKey)}</span>
        <span className={css.desc}>{t('lan.accessHint' as SettingsKey)}</span>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={lanAccess}
        className={clsx(css.switch, lanAccess && css.switchOn)}
        onClick={() => { setLanAccess(!lanAccess) }}
      >
        <span className={css.knob} />
      </button>
    </div>
  )
}
