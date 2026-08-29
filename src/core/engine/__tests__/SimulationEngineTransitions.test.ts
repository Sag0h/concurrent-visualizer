import { describe, expect, it } from 'vitest'
import { parseProgram } from '../../language/parseProgram'
import { FirstReadyScheduler } from '../../scheduler/FirstReadyScheduler'
import { createExecutionState } from '../createExecutionState'
import type { EnabledTransition } from '../EnabledTransition'
import { SimulationEngine } from '../SimulationEngine'

function createEngine(
  source: string,
  maxSteps = 100,
): SimulationEngine {
  return new SimulationEngine(
    createExecutionState(parseProgram(source)),
    new FirstReadyScheduler(),
    maxSteps,
  )
}

function transitionFor(
  engine: SimulationEngine,
  processId: string,
): EnabledTransition {
  const transition = engine
    .getEnabledTransitions()
    .find(
      (candidate) =>
        candidate.processId === processId,
    )

  if (!transition) {
    throw new Error(
      `Expected an enabled transition for ${processId}`,
    )
  }

  return transition
}

describe('SimulationEngine explicit transitions', () => {
  it('enumerates every ready process without mutating the state', () => {
    const engine = createEngine(`
      process P1 {
        int value = 1;
      }

      process P2 {
        int value = 2;
      }
    `)

    expect(engine.getEnabledTransitions()).toEqual([
      {
        type: 'PROCESS_STEP',
        processId: 'P1',
        resumesBlockedProcess: false,
        forcedByAtomicity: false,
      },
      {
        type: 'PROCESS_STEP',
        processId: 'P2',
        resumesBlockedProcess: false,
        forcedByAtomicity: false,
      },
    ])
    expect(engine.getState().stepCount).toBe(0)
    expect(
      engine.getState().program.processes.map(
        (process) => process.state,
      ),
    ).toEqual(['READY', 'READY'])
  })

  it('executes the selected process instead of consulting the scheduler', () => {
    const engine = createEngine(`
      process P1 {
        int value = 1;
      }

      process P2 {
        int value = 2;
      }
    `)

    engine.stepTransition(
      transitionFor(engine, 'P2'),
    )

    const [p1, p2] =
      engine.getState().program.processes

    expect(p1.state).toBe('READY')
    expect(p1.programCounter).toBe(0)
    expect(p2.state).toBe('FINISHED')
    expect(p2.localMemory.value).toBe(2)
    expect(engine.getState().history[0].processId).toBe('P2')
  })

  it('reports an enabled blocked process without reactivating it', () => {
    const engine = createEngine(`
      shared bool ready = false;

      process Waiter {
        await (ready);
      }
    `)

    engine.stepTransition(
      transitionFor(engine, 'Waiter'),
    )

    const waiter =
      engine.getState().program.processes[0]

    expect(waiter.state).toBe('BLOCKED')
    expect(engine.getEnabledTransitions()).toEqual([])

    engine.getState().program.sharedMemory.ready = true

    expect(engine.getEnabledTransitions()).toEqual([
      {
        type: 'PROCESS_STEP',
        processId: 'Waiter',
        resumesBlockedProcess: true,
        forcedByAtomicity: false,
      },
    ])
    expect(waiter.state).toBe('BLOCKED')
    expect(waiter.blockingReason?.type).toBe('AWAIT')

    engine.stepTransition(
      transitionFor(engine, 'Waiter'),
    )

    expect(waiter.state).toBe('FINISHED')
    expect(waiter.blockingReason).toBeUndefined()
  })

  it('exposes only the active atomic process once it enters the region', () => {
    const engine = createEngine(`
      process P1 {
        atomic {
          int inside = 1;
        }
      }

      process P2 {
        int outside = 2;
      }
    `)

    engine.stepTransition(
      transitionFor(engine, 'P1'),
    )

    expect(engine.getEnabledTransitions()).toEqual([
      {
        type: 'PROCESS_STEP',
        processId: 'P1',
        resumesBlockedProcess: false,
        forcedByAtomicity: true,
      },
    ])
  })

  it('rejects a process that is not enabled', () => {
    const engine = createEngine(`
      process P1 {
        int value = 1;
      }
    `)

    expect(() => engine.stepTransition({
      type: 'PROCESS_STEP',
      processId: 'Missing',
      resumesBlockedProcess: false,
      forcedByAtomicity: false,
    })).toThrowError(
      'Transition for process "Missing" is not enabled',
    )
    expect(engine.getState().stepCount).toBe(0)
  })

  it('does not expose transitions after reaching the step limit', () => {
    const engine = createEngine(`
      process Spinner {
        while (true) { }
      }
    `, 1)

    engine.stepTransition(
      transitionFor(engine, 'Spinner'),
    )

    expect(engine.getEnabledTransitions()).toEqual([])
    expect(engine.stepTransition({
      type: 'PROCESS_STEP',
      processId: 'Spinner',
      resumesBlockedProcess: false,
      forcedByAtomicity: false,
    })).toBe(false)
  })
})
