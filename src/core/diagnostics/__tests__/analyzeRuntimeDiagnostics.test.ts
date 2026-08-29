import { describe, expect, it } from 'vitest'
import { createExecutionState } from '../../engine/createExecutionState'
import { SimulationEngine } from '../../engine/SimulationEngine'
import { parseProgram } from '../../language/parseProgram'
import { FirstReadyScheduler } from '../../scheduler/FirstReadyScheduler'

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

function executeSteps(
  engine: SimulationEngine,
  stepCount: number,
): void {
  for (let step = 0; step < stepCount; step++) {
    engine.step()
  }
}

describe('analyzeRuntimeDiagnostics', () => {
  it('detects repeated polling of shared state in an empty loop', () => {
    const engine = createEngine(`
      shared bool ready = false;

      process Spinner {
        while (!ready) { }
      }
    `)

    executeSteps(engine, 4)

    expect(engine.getSnapshot().runtimeDiagnostics).toContainEqual(
      expect.objectContaining({
        code: 'BUSY_WAITING_OBSERVED',
        processIds: ['Spinner'],
      }),
    )
  })

  it('does not call a loop busy waiting when it does not poll shared state', () => {
    const engine = createEngine(`
      process Spinner {
        while (true) { }
      }
    `)

    executeSteps(engine, 4)

    expect(engine.getSnapshot().runtimeDiagnostics).not.toContainEqual(
      expect.objectContaining({
        code: 'BUSY_WAITING_OBSERVED',
      }),
    )
  })

  it('reports a starvation risk for a ready process repeatedly skipped', () => {
    const engine = createEngine(`
      process Spinner {
        while (true) { }
      }

      process Postponed {
        int observed = 1;
      }
    `)

    executeSteps(engine, 12)

    expect(engine.getSnapshot().runtimeDiagnostics).toContainEqual(
      expect.objectContaining({
        code: 'STARVATION_RISK',
        processIds: ['Postponed'],
      }),
    )
  })

  it('distinguishes the safety step limit from deadlock', () => {
    const engine = createEngine(`
      process NonTerminating {
        while (true) { }
      }
    `, 3)

    executeSteps(engine, 4)

    const snapshot = engine.getSnapshot()

    expect(snapshot.executionStatus).toBe('STEP_LIMIT_REACHED')
    expect(snapshot.deadlock).toBeUndefined()
    expect(snapshot.runtimeDiagnostics).toContainEqual(
      expect.objectContaining({
        code: 'STEP_LIMIT_REACHED',
      }),
    )
  })

  it('keeps deadlock as the primary status when it occurs at the limit', () => {
    const engine = createEngine(`
      sem unavailable = 0;

      process Blocked {
        P(unavailable);
      }
    `, 1)

    engine.step()

    const snapshot = engine.getSnapshot()

    expect(snapshot.executionStatus).toBe('DEADLOCK')
    expect(snapshot.deadlock).toBeDefined()
    expect(snapshot.runtimeDiagnostics).not.toContainEqual(
      expect.objectContaining({
        code: 'STEP_LIMIT_REACHED',
      }),
    )
  })
})
