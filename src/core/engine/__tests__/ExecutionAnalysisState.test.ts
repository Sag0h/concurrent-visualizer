import { describe, expect, it } from 'vitest'
import { parseProgram } from '../../language/parseProgram'
import { FirstReadyScheduler } from '../../scheduler/FirstReadyScheduler'
import { cloneExecutionState } from '../cloneExecutionState'
import { createExecutionState } from '../createExecutionState'
import { SimulationEngine } from '../SimulationEngine'

const protectedAccessSource = `
  sem mutex = 1;
  shared int value = 0;

  process P1 {
    P(mutex);
    value = value + 1;
    V(mutex);
  }

  process P2 {
    P(mutex);
    value = value + 1;
    V(mutex);
  }
`

function createEngine(): SimulationEngine {
  return new SimulationEngine(
    createExecutionState(
      parseProgram(protectedAccessSource),
    ),
    new FirstReadyScheduler(),
  )
}

function run(engine: SimulationEngine): void {
  while (!engine.isFinished()) {
    if (!engine.step()) {
      throw new Error('Expected execution to progress')
    }
  }
}

describe('ExecutionAnalysisState', () => {
  it('records only semaphore and memory evidence used by diagnostics', () => {
    const engine = createEngine()

    run(engine)

    const analysis = engine.getState().analysisState

    expect(analysis?.memory.initialSemaphoreValues).toEqual({
      mutex: 1,
    })
    expect(
      analysis?.memory.semaphoreEvents.map(
        (event) => event.semaphoreEvent?.operation,
      ),
    ).toEqual(['P', 'V', 'P', 'V'])
    expect(
      analysis?.memory.memoryAccessEvents.map(
        (event) => event.type,
      ),
    ).toEqual([
      'SHARED_READ',
      'SHARED_WRITE',
      'SHARED_READ',
      'SHARED_WRITE',
    ])
    expect(engine.getState().history.length).toBeGreaterThan(
      analysis?.memory.semaphoreEvents.length ?? 0,
    )
    expect(
      engine.getState().microOperationHistory?.length,
    ).toBeGreaterThan(
      analysis?.memory.memoryAccessEvents.length ?? 0,
    )
  })

  it('builds memory diagnostics from analysis metadata instead of raw traces', () => {
    const engine = createEngine()

    run(engine)

    const expectedConflicts =
      engine.getSnapshot().memoryAccessConflicts
    const state = cloneExecutionState(
      engine.getState(),
    )

    state.history = []
    state.microOperationHistory = []

    const restored = new SimulationEngine(
      state,
      new FirstReadyScheduler(),
    )

    expect(
      restored.getSnapshot().memoryAccessConflicts,
    ).toEqual(expectedConflicts)
  })

  it('clones analysis metadata independently in a fork', () => {
    const engine = createEngine()

    engine.step()

    const fork = engine.fork()

    fork.step()

    expect(
      fork.getState().analysisState
        ?.memory.memoryAccessEvents,
    ).toHaveLength(1)
    expect(
      engine.getState().analysisState
        ?.memory.memoryAccessEvents,
    ).toHaveLength(0)
    expect(
      fork.getState().analysisState,
    ).not.toBe(engine.getState().analysisState)
  })

  it('reconstructs analysis metadata for a legacy execution state', () => {
    const engine = createEngine()

    run(engine)

    const state = cloneExecutionState(
      engine.getState(),
    )
    const expectedAnalysis = structuredClone(
      state.analysisState,
    )

    state.analysisState = undefined

    const restored = new SimulationEngine(
      state,
      new FirstReadyScheduler(),
    )

    expect(restored.getState().analysisState).toEqual(
      expectedAnalysis,
    )
  })
})
