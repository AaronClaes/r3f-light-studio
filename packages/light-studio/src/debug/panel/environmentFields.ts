import {
  ENVIRONMENT_DEFAULTS,
  ENVIRONMENT_OPTIONS,
  type EnvironmentBackground,
  type EnvironmentConfig,
  type EnvironmentGround,
} from '../../core/schema'
import {
  controlFor,
  entriesOf,
  propertyOf,
  type Control,
  type Field,
  type FieldValue,
} from './controls'

/** `fieldsFor`, for the one part of a rig that is not a light. */

export type EnvironmentField = Field<EnvironmentConfig, Partial<EnvironmentConfig>>

/** Its own table, not the lights': `height` here is a horizon, not a softbox. */
const FIELD_UI: Record<string, Control> = {
  intensity: { min: 0, step: 0.05 },
  // Higher is a sharper reflection and a slower editor.
  resolution: { options: [64, 128, 256, 512, 1024] },
  blur: { min: 0, max: 1, step: 0.01 },
  radius: { min: 1, step: 5 },
  height: { min: 0, step: 1 },
  scale: { min: 1, step: 50 },
  /** A full turn is 6.28 radians, so a tenth of a degree is noise. */
  rotation: { step: 0.01 },
}

/** Reads as a property of the environment, where a bare `enabled` would not. */
const TOGGLE_LABEL: Record<string, string> = {
  background: 'backdrop',
  ground: 'ground projection',
}

/** Where it comes from, then whether you can see it, then the dome. */
const GROUP = {
  source: 0,
  background: 1000,
  backgroundTuning: 1500,
  ground: 2000,
  groundTuning: 2500,
}

/**
 * The environment shares `intensity`, `rotation`, `radius` and `height` with a
 * light type or with itself one level up, and leva maps a `set` by leaf key.
 */
const PREFIX = 'env-'

export function environmentFields(): EnvironmentField[] {
  const source: EnvironmentField[] = []
  const background: EnvironmentField[] = []
  const ground: EnvironmentField[] = []

  for (const [key, fallback] of entriesOf(ENVIRONMENT_DEFAULTS)) {
    // The row's eye, in the outliner.
    if (key === 'enabled') continue

    if (key === 'background') {
      background.push(
        ...groupFields(
          'background',
          fallback as EnvironmentBackground,
          GROUP.background,
          GROUP.backgroundTuning,
        ),
      )
      continue
    }

    if (key === 'ground') {
      ground.push(
        ...groupFields('ground', fallback as EnvironmentGround, GROUP.ground, GROUP.groundTuning),
      )
      continue
    }

    const control = controlFor(key, fallback, {
      ui: FIELD_UI,
      options: ENVIRONMENT_OPTIONS[key],
    })
    if (!control) continue

    source.push({
      key: `${PREFIX}${key}`,
      path: [],
      order: GROUP.source + source.length,
      input: (environment) => ({ ...control, label: key, value: propertyOf(environment, key) }),
      read: (environment) => propertyOf(environment, key) as FieldValue,
      patch: (_environment, value) => ({ [key]: value }) as Partial<EnvironmentConfig>,
    })
  }

  return [...source, ...background, ...ground]
}

/** `enabled` sits above the folder, as a light's shadow toggle does. */
function groupFields(
  group: 'background' | 'ground',
  fallback: EnvironmentBackground | EnvironmentGround,
  toggleOrder: number,
  tuningOrder: number,
): EnvironmentField[] {
  const fields: EnvironmentField[] = []

  for (const [key, value] of entriesOf(fallback)) {
    const control = controlFor(key, value, { ui: FIELD_UI })
    if (!control) continue

    const tuning = key !== 'enabled'

    fields.push({
      key: `${PREFIX}${group}-${key}`,
      path: tuning ? [group] : [],
      order: tuning ? tuningOrder + fields.length : toggleOrder,
      input: (environment) => ({
        ...control,
        label: tuning ? key : TOGGLE_LABEL[group],
        value: propertyOf(environment[group], key),
      }),
      read: (environment) => propertyOf(environment[group], key) as FieldValue,
      patch: (environment, next) =>
        ({ [group]: { ...environment[group], [key]: next } }) as Partial<EnvironmentConfig>,
    })
  }

  return fields
}
