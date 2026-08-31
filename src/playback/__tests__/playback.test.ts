import { describe, expect, it } from 'vitest'
import { createExecutionState } from '../../core/engine/createExecutionState'
import { SimulationEngine } from '../../core/engine/SimulationEngine'
import { parseProgram } from '../../core/language/parseProgram'
import { FirstReadyScheduler } from '../../core/scheduler/FirstReadyScheduler'
import {
  advancePlayback,
  playbackDisplayState,
  playbackIntervalMs,
} from '../playback'

function createEngine(
  source: string,
  maximumSteps = 100,
): SimulationEngine {
  return new SimulationEngine(
    createExecutionState(parseProgram(source)),
    new FirstReadyScheduler(),
    maximumSteps,
  )
}

describe('continuous playback', () => {
  it('converts playback speed into a deterministic interval', () => {
    expect(playbackIntervalMs(0.5)).toBe(2_000)
    expect(playbackIntervalMs(1)).toBe(1_000)
    expect(playbackIntervalMs(2)).toBe(500)
    expect(playbackIntervalMs(4)).toBe(250)
  })

  it('shows terminal program states instead of paused', () => {
    expect(playbackDisplayState(false, 'RUNNING'))
      .toBe('PAUSED')
    expect(playbackDisplayState(true, 'RUNNING'))
      .toBe('PLAYING')
    expect(playbackDisplayState(false, 'FINISHED'))
      .toBe('FINISHED')
    expect(playbackDisplayState(false, 'DEADLOCK'))
      .toBe('DEADLOCK')
    expect(playbackDisplayState(
      false,
      'STEP_LIMIT_REACHED',
    )).toBe('STEP_LIMIT_REACHED')
  })

  it('advances until a program finishes', () => {
    const engine = createEngine(`
      process Worker {
        int value = 1;
        value = value + 1;
      }
    `)
    let result = advancePlayback(engine)

    while (result.shouldContinue) {
      result = advancePlayback(engine)
    }

    expect(result.snapshot.executionStatus).toBe('FINISHED')
    expect(result.snapshot.processes[0].localMemory.value).toBe(2)
  })

  it('stops as soon as a deadlock becomes visible', () => {
    const engine = createEngine(`
      sem ready = 0;

      process Worker {
        P(ready);
      }
    `)

    const result = advancePlayback(engine)

    expect(result.shouldContinue).toBe(false)
    expect(result.snapshot.executionStatus).toBe('DEADLOCK')
  })

  it('stops when the engine reaches its step limit', () => {
    const engine = createEngine(`
      process Worker {
        int value = 0;
        while (true) {
          value = value + 1;
        }
      }
    `, 3)
    let result = advancePlayback(engine)

    while (result.shouldContinue) {
      result = advancePlayback(engine)
    }

    expect(result.snapshot.executionStatus)
      .toBe('STEP_LIMIT_REACHED')
  })
})
