import type { SimulationEngine } from '../core/engine/SimulationEngine'
import type { SimulationSnapshot } from '../core/engine/SimulationSnapshot'
import type { ProgramExecutionStatus } from '../core/deadlock/DeadlockDiagnostic'

export const PLAYBACK_SPEEDS = [
  0.5,
  1,
  2,
  4,
] as const

export type PlaybackSpeed =
  typeof PLAYBACK_SPEEDS[number]

const BASE_PLAYBACK_INTERVAL_MS = 1_000

export interface PlaybackAdvanceResult {
  readonly snapshot: SimulationSnapshot
  readonly shouldContinue: boolean
}

export type PlaybackDisplayState =
  | 'PLAYING'
  | 'PAUSED'
  | 'FINISHED'
  | 'DEADLOCK'
  | 'STEP_LIMIT_REACHED'

export function playbackDisplayState(
  isPlaying: boolean,
  executionStatus?: ProgramExecutionStatus,
): PlaybackDisplayState {
  if (isPlaying) {
    return 'PLAYING'
  }

  switch (executionStatus) {
    case 'FINISHED':
    case 'DEADLOCK':
    case 'STEP_LIMIT_REACHED':
      return executionStatus
    default:
      return 'PAUSED'
  }
}

export function playbackIntervalMs(
  speed: PlaybackSpeed,
): number {
  return BASE_PLAYBACK_INTERVAL_MS / speed
}

export function advancePlayback(
  engine: SimulationEngine,
): PlaybackAdvanceResult {
  const progressed = engine.step()
  const snapshot = engine.getSnapshot()

  return {
    snapshot,
    shouldContinue:
      progressed
      && snapshot.executionStatus !== 'FINISHED'
      && snapshot.executionStatus !== 'DEADLOCK'
      && snapshot.executionStatus
        !== 'STEP_LIMIT_REACHED',
  }
}
