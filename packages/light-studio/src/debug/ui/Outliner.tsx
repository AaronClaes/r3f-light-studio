import { useState } from 'react'

import { ENVIRONMENT_ID } from '../../core/schema'
import type { StudioState } from '../../core/state'
import { useStudio, useStudioStore } from '../context'
import { AddMenu } from './AddMenu'
import { EnvironmentRow } from './EnvironmentRow'
import { CameraIcon, CloseIcon, GreyIcon } from './icons'
import { LightRow } from './LightRow'
import { usePaint } from './paint'
import { Panel } from './Panel'

/**
 * The rig as a list. Owns the three things that are about a light rather than
 * about its lighting: its name, whether it is on, and solo. Everything else is
 * the properties panel.
 */
export function Outliner() {
  const ids = useStudio(selectIds)
  const soloIds = useStudio((state) => state.soloIds)
  const selectedId = useStudio((state) => state.selectedId)
  const toggleHint = useStudio((state) => state.toggleHint)
  const store = useStudioStore()

  const [renaming, setRenaming] = useState<string | null>(null)
  const paint = usePaint(ids)

  const soloing = soloIds.length > 0

  return (
    <Panel
      title="Lights"
      aside={
        <>
          {soloing ? (
            <button
              type="button"
              className="ls-solo-badge"
              onClick={() => store.getState().clearSolo()}
              title={`Showing only ${soloIds.length} of the lights. Click to show all.`}
            >
              {soloIds.length}
            </button>
          ) : null}

          <GreyToggle />

          <FreeCameraToggle />

          <AddMenu />

          {/* Naming the key matters: someone who closed the editor from here
              has nothing else to tell them how to get it back. */}
          <button
            type="button"
            className="ls-icon ls-close"
            onClick={() => store.getState().setVisible(false)}
            title={toggleHint ? `Hide the studio (${toggleHint})` : 'Hide the studio'}
            aria-label="Hide the studio"
          >
            <CloseIcon />
          </button>
        </>
      }
    >
      <div className="ls-list">
        {/* A fixture rather than a row: you cannot add or remove it. */}
        <EnvironmentRow
          selected={selectedId === ENVIRONMENT_ID}
          soloed={soloIds.includes(ENVIRONMENT_ID)}
          soloing={soloing}
        />

        {ids.length === 0 ? (
          <p className="ls-empty">No lights yet — add one with +.</p>
        ) : (
          ids.map((id, index) => (
            <LightRow
              key={id}
              id={id}
              index={index}
              selected={id === selectedId}
              soloed={soloIds.includes(id)}
              soloing={soloing}
              renaming={renaming === id}
              onRename={setRenaming}
              paint={paint}
            />
          ))
        )}
      </div>
    </Panel>
  )
}

/**
 * In the header rather than on the environment row, because it is the one
 * control here about everything *except* the rig.
 */
function GreyToggle() {
  const store = useStudioStore()
  const grey = useStudio((state) => state.grey)

  return (
    <button
      type="button"
      className="ls-icon"
      data-on={grey}
      onClick={() => store.getState().setGrey(!grey)}
      title="Paint the scene one neutral grey, so you are looking at the light and not at the colours it lands on. Never saved to the file."
      aria-label="Paint the scene one neutral grey"
      aria-pressed={grey}
    >
      <GreyIcon />
    </button>
  )
}

/**
 * Off until asked for, so the app's camera keeps behaving as the app built it
 * until you decide otherwise. Switching it off hands the camera back where it
 * was, not where you left it.
 */
function FreeCameraToggle() {
  const store = useStudioStore()
  const freeCamera = useStudio((state) => state.freeCamera)

  return (
    <button
      type="button"
      className="ls-icon"
      data-on={freeCamera}
      onClick={() => store.getState().setFreeCamera(!freeCamera)}
      title="Orbit, pan and zoom without the limits the app puts on its camera. Switch it off to get the app's own camera back."
      aria-label="Free the camera"
      aria-pressed={freeCamera}
    >
      <CameraIcon />
    </button>
  )
}

/** Ids, not whole lights: a fresh array of objects is an unstable snapshot. */
function selectIds(state: StudioState): string[] {
  return state.setup.lights.map((light) => light.id)
}
