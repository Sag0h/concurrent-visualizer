import { describe, expect, it } from 'vitest'
import { createExecutionState } from '../../engine/createExecutionState'
import { SimulationEngine } from '../../engine/SimulationEngine'
import { parseProgram } from '../../language/parseProgram'
import { RoundRobinScheduler } from '../../scheduler/RoundRobinScheduler'

function createEngine(source: string): SimulationEngine {
  return new SimulationEngine(
    createExecutionState(parseProgram(source)),
    new RoundRobinScheduler(),
    100,
  )
}

function runUntilNoProgress(
  engine: SimulationEngine,
): void {
  while (
    !engine.isFinished()
    && !engine.hasReachedStepLimit()
    && engine.step()
  ) {
    // The engine itself decides whether another process can advance.
  }
}

describe('deadlock analysis', () => {
  it('distinguishes temporary blocking from completion', () => {
    const engine = createEngine(`
      sem inicio = 0;

      process Trabajador {
        P(inicio);
        bool continuo = true;
      }

      process Coordinador {
        V(inicio);
      }
    `)

    expect(engine.getSnapshot().executionStatus).toBe(
      'RUNNING',
    )

    expect(engine.step()).toBe(true)

    expect(engine.getSnapshot()).toEqual(
      expect.objectContaining({
        executionStatus: 'TEMPORARILY_BLOCKED',
        deadlock: undefined,
      }),
    )

    expect(engine.step()).toBe(true)

    const enabledSnapshot = engine.getSnapshot()

    expect(enabledSnapshot.processes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'Trabajador',
          state: 'BLOCKED',
        }),
      ]),
    )
    expect(enabledSnapshot.semaphores[0].value).toBe(1)
    expect(enabledSnapshot.executionStatus).toBe(
      'TEMPORARILY_BLOCKED',
    )
    expect(engine.isDeadlocked()).toBe(false)

    runUntilNoProgress(engine)

    expect(engine.isFinished()).toBe(true)
    expect(engine.getSnapshot().executionStatus).toBe(
      'FINISHED',
    )
  })

  it('detects a circular wait and exposes its wait-for graph', () => {
    const engine = createEngine(`
      sem recursoA = 1;
      sem recursoB = 1;

      process P1 {
        P(recursoA);
        P(recursoB);
        V(recursoB);
        V(recursoA);
      }

      process P2 {
        P(recursoB);
        P(recursoA);
        V(recursoA);
        V(recursoB);
      }
    `)

    runUntilNoProgress(engine)

    const snapshot = engine.getSnapshot()
    const deadlock = snapshot.deadlock

    expect(engine.isFinished()).toBe(false)
    expect(engine.isDeadlocked()).toBe(true)
    expect(snapshot.executionStatus).toBe('DEADLOCK')
    expect(deadlock).toEqual(
      expect.objectContaining({
        kind: 'CIRCULAR_WAIT',
        detectedAtStep: 4,
        replayTargetStep: 4,
        blockedProcessIds: ['P1', 'P2'],
        involvedProcessIds: ['P1', 'P2'],
        graphIsComplete: true,
      }),
    )
    expect(deadlock?.involvedResources).toEqual([
      {
        id: 'SEMAPHORE:recursoA',
        kind: 'SEMAPHORE',
        name: 'recursoA',
      },
      {
        id: 'SEMAPHORE:recursoB',
        kind: 'SEMAPHORE',
        name: 'recursoB',
      },
    ])
    expect(deadlock?.waitForEdges).toEqual(
      expect.arrayContaining([
        {
          waitingProcessId: 'P1',
          holdingProcessId: 'P2',
          resourceId: 'SEMAPHORE:recursoB',
        },
        {
          waitingProcessId: 'P2',
          holdingProcessId: 'P1',
          resourceId: 'SEMAPHORE:recursoA',
        },
      ]),
    )
    expect(deadlock?.cycles).toEqual([
      {
        processIds: ['P1', 'P2'],
        resourceIds: [
          'SEMAPHORE:recursoA',
          'SEMAPHORE:recursoB',
        ],
      },
    ])
    expect(engine.getState().history).toHaveLength(4)
  })

  it('replays a deterministic execution to the same deadlock', () => {
    const engine = createEngine(`
      sem primero = 1;
      sem segundo = 1;

      process P1 {
        P(primero);
        P(segundo);
      }

      process P2 {
        P(segundo);
        P(primero);
      }
    `)

    runUntilNoProgress(engine)

    const firstDiagnostic = structuredClone(
      engine.getSnapshot().deadlock,
    )
    const firstHistory = structuredClone(
      engine.getState().history,
    )

    engine.reset()
    runUntilNoProgress(engine)

    expect(engine.getSnapshot().deadlock).toEqual(
      firstDiagnostic,
    )
    expect(engine.getState().history).toEqual(
      firstHistory,
    )
  })

  it('reports terminal semaphore blocking when no holder is known', () => {
    const engine = createEngine(`
      sem evento = 0;

      process Trabajador {
        P(evento);
      }
    `)

    runUntilNoProgress(engine)

    expect(engine.getSnapshot().deadlock).toEqual(
      expect.objectContaining({
        kind: 'TERMINAL_BLOCKING',
        blockedProcessIds: ['Trabajador'],
        involvedProcessIds: ['Trabajador'],
        involvedResources: [
          {
            id: 'SEMAPHORE:evento',
            kind: 'SEMAPHORE',
            name: 'evento',
          },
        ],
        cycles: [],
        graphIsComplete: false,
      }),
    )
  })

  it('reports terminal await blocking without inventing resources', () => {
    const engine = createEngine(`
      shared bool habilitado = false;

      process Trabajador {
        await (habilitado);
      }
    `)

    runUntilNoProgress(engine)

    expect(engine.getSnapshot().deadlock).toEqual(
      expect.objectContaining({
        kind: 'TERMINAL_BLOCKING',
        blockedProcessIds: ['Trabajador'],
        involvedResources: [],
        waitForEdges: [],
        cycles: [],
        graphIsComplete: false,
      }),
    )
  })

  it('detects a self-cycle when one process waits for another permit', () => {
    const engine = createEngine(`
      sem recurso = 1;

      process Trabajador {
        P(recurso);
        P(recurso);
        V(recurso);
        V(recurso);
      }
    `)

    runUntilNoProgress(engine)

    expect(engine.getSnapshot().deadlock).toEqual(
      expect.objectContaining({
        kind: 'CIRCULAR_WAIT',
        involvedProcessIds: ['Trabajador'],
        cycles: [
          {
            processIds: ['Trabajador'],
            resourceIds: ['SEMAPHORE:recurso'],
          },
        ],
      }),
    )
  })
})
