import { ENVIRONMENT_ID } from '../../core/schema'
import { useStudio, useStudioStore } from '../context'
import { BackdropIcon, EyeIcon, SoloIcon } from './icons'
import { RowAction } from './RowButtons'

/**
 * Shaped like a light's row but not one: nothing to rename, duplicate or
 * delete. The backdrop toggle takes the type label's slot, and stays put rather
 * than appearing on hover, because a lightformer is invisible until you use it.
 */
export function EnvironmentRow({
  selected,
  soloed,
  soloing,
}: {
  selected: boolean
  soloed: boolean
  soloing: boolean
}) {
  const store = useStudioStore()
  const enabled = useStudio((state) => state.setup.environment.enabled)
  const committed = useStudio((state) => state.setup.environment.background.enabled)
  const forced = useStudio((state) => state.forceBackground)

  return (
    <div
      className="ls-row ls-row-env"
      data-lit={soloing ? soloed : enabled}
      data-selected={selected}
      onPointerDown={() => store.getState().select(ENVIRONMENT_ID)}
    >
      <span className="ls-swatch ls-swatch-env" />
      <span className="ls-name">Environment</span>

      {/* Whether the backdrop ships is `background.enabled` in the panel; this
          only overrides it. Disabled once the rig commits to one of its own. */}
      <RowAction
        className="ls-backdrop"
        disabled={committed}
        on={committed || forced}
        title={
          committed
            ? 'The rig shows the environment behind the scene — switch that off under backdrop, below.'
            : 'Show the environment behind the scene while you work, so you can see what is in it. Never saved to the file.'
        }
        onPress={() => store.getState().setForceBackground(!forced)}
      >
        <BackdropIcon />
      </RowAction>

      <RowAction
        on={enabled}
        title={enabled ? 'Switch the environment off' : 'Switch the environment on'}
        onPress={() => store.getState().updateEnvironment({ enabled: !enabled })}
      >
        <EyeIcon open={enabled} />
      </RowAction>

      <RowAction
        className="ls-solo"
        on={soloed}
        title="Solo — show only the environment. Never saved to the file."
        onPress={() => store.getState().setSolo(ENVIRONMENT_ID, !soloed)}
      >
        <SoloIcon on={soloed} />
      </RowAction>
    </div>
  )
}
