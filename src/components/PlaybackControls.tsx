import {
  PLAYBACK_SPEEDS,
  playbackDisplayState,
  type PlaybackSpeed,
} from '../playback/playback'
import type { ProgramExecutionStatus } from '../core/deadlock/DeadlockDiagnostic'

interface PlaybackControlsProps {
  readonly isPlaying: boolean
  readonly canPlay: boolean
  readonly speed: PlaybackSpeed
  readonly executionStatus?: ProgramExecutionStatus
  readonly onToggle: () => void
  readonly onSpeedChange: (
    speed: PlaybackSpeed,
  ) => void
}

export function PlaybackControls({
  isPlaying,
  canPlay,
  speed,
  executionStatus,
  onToggle,
  onSpeedChange,
}: PlaybackControlsProps) {
  const displayState = playbackDisplayState(
    isPlaying,
    executionStatus,
  )

  return (
    <section
      className="playback-controls"
      aria-label="Continuous playback"
    >
      <button
        type="button"
        className={isPlaying ? 'pause-button' : 'play-button'}
        disabled={!isPlaying && !canPlay}
        aria-pressed={isPlaying}
        onClick={onToggle}
      >
        {isPlaying ? 'Pause' : 'Play'}
      </button>

      <label htmlFor="playback-speed">
        Speed
      </label>
      <select
        id="playback-speed"
        value={speed}
        onChange={(event) =>
          onSpeedChange(
            Number(event.target.value) as PlaybackSpeed,
          )
        }
      >
        {PLAYBACK_SPEEDS.map((availableSpeed) => (
          <option
            key={availableSpeed}
            value={availableSpeed}
          >
            {availableSpeed}×
          </option>
        ))}
      </select>

      <span
        className={
          `playback-state playback-state-${displayState.toLowerCase()}`
        }
        aria-live="polite"
      >
        {playbackStateLabel(displayState)}
      </span>
    </section>
  )
}

function playbackStateLabel(
  state: ReturnType<typeof playbackDisplayState>,
): string {
  switch (state) {
    case 'PLAYING':
      return 'Playing'
    case 'PAUSED':
      return 'Paused'
    case 'FINISHED':
      return 'Finished'
    case 'DEADLOCK':
      return 'Deadlock'
    case 'STEP_LIMIT_REACHED':
      return 'Step limit'
  }
}
