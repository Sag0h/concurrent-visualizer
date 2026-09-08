import { describe, expect, it } from 'vitest'
import { analyzeDeadlock } from '../../deadlock/analyzeDeadlock'
import { exploreForDeadlock } from '../../exploration/exploreForDeadlock'
import { parseProgram } from '../../language/parseProgram'
import { RoundRobinScheduler } from '../../scheduler/RoundRobinScheduler'
import { createExecutionState } from '../createExecutionState'
import { SimulationEngine } from '../SimulationEngine'

function createEngine(
  source: string,
): SimulationEngine {
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
    // The engine determines when no process can advance.
  }
}

describe('semaphore arrays', () => {
  it('parses an array declaration and indexed P/V operations', () => {
    const program = parseProgram(`
      sem[] mutexes = [1, 0, 2];

      process Worker[id:0..2] {
        P(mutexes[id]);
        V(mutexes[id]);
      }
    `)

    expect(program.semaphores).toEqual({
      'mutexes[0]': {
        name: 'mutexes[0]',
        value: 1,
      },
      'mutexes[1]': {
        name: 'mutexes[1]',
        value: 0,
      },
      'mutexes[2]': {
        name: 'mutexes[2]',
        value: 2,
      },
    })

    expect(
      program.processes[0].instructions,
    ).toMatchObject([
      {
        type: 'SEMAPHORE_P',
        semaphoreName: 'mutexes',
        semaphoreIndex: {
          type: 'VARIABLE',
          name: 'id',
        },
      },
      {
        type: 'SEMAPHORE_V',
        semaphoreName: 'mutexes',
        semaphoreIndex: {
          type: 'VARIABLE',
          name: 'id',
        },
      },
    ])
  })

  it('executes indexed P/V and records the resolved element', () => {
    const engine = createEngine(`
      sem[] gates = [1, 0];

      process Worker {
        int index = 0;
        P(gates[index]);
        index = index + 1;
        V(gates[index]);
      }
    `)

    runUntilNoProgress(engine)

    expect(engine.isFinished()).toBe(true)
    expect(engine.getSnapshot().semaphores).toEqual([
      {
        name: 'gates[0]',
        value: 0,
        waitingProcessIds: [],
      },
      {
        name: 'gates[1]',
        value: 1,
        waitingProcessIds: [],
      },
    ])
    expect(
      engine.getState().history
        .filter((event) => event.semaphoreEvent)
        .map((event) => event.semaphoreEvent?.semaphoreName),
    ).toEqual(['gates[0]', 'gates[1]'])
  })

  it('supports expressions as semaphore indexes', () => {
    const engine = createEngine(`
      sem[] gates = [0, 1];

      process Worker {
        int index = 0;
        P(gates[(index + 1) % 2]);
      }
    `)

    runUntilNoProgress(engine)

    expect(engine.isFinished()).toBe(true)
    expect(
      engine.getState().program.semaphores?.['gates[1]'].value,
    ).toBe(0)
  })

  it('captures the selected element while P remains blocked', () => {
    const engine = createEngine(`
      shared int selected = 0;
      sem[] gates = [0, 1];

      process Waiter {
        P(gates[selected]);
      }

      process Changer {
        selected = 1;
      }
    `)

    expect(engine.step()).toBe(true)

    const waiter = engine.getState().program.processes[0]
    expect(waiter.blockingReason).toEqual({
      type: 'SEMAPHORE_P',
      semaphoreName: 'gates[0]',
    })

    runUntilNoProgress(engine)

    expect(
      engine.getState().program.sharedMemory.selected,
    ).toBe(1)
    expect(waiter.state).toBe('BLOCKED')
    expect(waiter.blockingReason).toEqual({
      type: 'SEMAPHORE_P',
      semaphoreName: 'gates[0]',
    })
  })

  it('reuses the captured element after a blocked P is enabled', () => {
    const engine = createEngine(`
      shared int selected = 0;
      sem[] gates = [0, 1];

      process Waiter {
        P(gates[selected]);
      }

      process Changer {
        selected = 1;
        V(gates[0]);
      }
    `)

    runUntilNoProgress(engine)

    expect(engine.isFinished()).toBe(true)
    expect(
      engine.getState().program.sharedMemory.selected,
    ).toBe(1)
    expect(engine.getSnapshot().semaphores).toEqual([
      {
        name: 'gates[0]',
        value: 0,
        waitingProcessIds: [],
      },
      {
        name: 'gates[1]',
        value: 1,
        waitingProcessIds: [],
      },
    ])
  })

  it('reports invalid indexes at runtime', () => {
    const outOfBounds = createEngine(`
      sem[] gates = [1, 1];

      process Worker {
        P(gates[2]);
      }
    `)

    expect(() => outOfBounds.step()).toThrow(
      'Semaphore index 2 is out of bounds for "gates"',
    )

    const wrongType = createEngine(`
      sem[] gates = [1];

      process Worker {
        bool selected = true;
        P(gates[selected]);
      }
    `)

    expect(wrongType.step()).toBe(true)
    expect(() => wrongType.step()).toThrow(
      'Semaphore index must evaluate to an integer',
    )
  })

  it('distinguishes missing indexes, scalar semaphores and unknown arrays', () => {
    const missingIndex = createEngine(`
      sem[] gates = [1];

      process Worker {
        P(gates);
      }
    `)

    expect(() => missingIndex.step()).toThrow(
      'Semaphore array "gates" requires an index',
    )

    const indexedScalar = createEngine(`
      sem mutex = 1;

      process Worker {
        P(mutex[0]);
      }
    `)

    expect(() => indexedScalar.step()).toThrow(
      'Semaphore "mutex" is not an array',
    )

    const unknownArray = createEngine(`
      process Worker {
        P(missing[0]);
      }
    `)

    expect(() => unknownArray.step()).toThrow(
      'Semaphore array "missing" is not defined',
    )
  })

  it('detects circular wait through indexed semaphore elements', () => {
    const engine = createEngine(`
      sem[] resources = [1, 1];

      process P1 {
        P(resources[0]);
        P(resources[1]);
        V(resources[1]);
        V(resources[0]);
      }

      process P2 {
        P(resources[1]);
        P(resources[0]);
        V(resources[0]);
        V(resources[1]);
      }
    `)

    runUntilNoProgress(engine)

    const diagnostic = analyzeDeadlock(engine.getState())
    const deadlock = diagnostic.deadlock

    expect(diagnostic.status).toBe('DEADLOCK')
    expect(deadlock?.kind).toBe('CIRCULAR_WAIT')
    expect(deadlock?.involvedResources.map(
      (resource) => resource.name,
    )).toEqual(['resources[0]', 'resources[1]'])
  })

  it('includes indexed semaphores in BFS exploration', () => {
    const engine = createEngine(`
      sem[] resources = [1, 1];

      process P1 {
        P(resources[0]);
        P(resources[1]);
        V(resources[1]);
        V(resources[0]);
      }

      process P2 {
        P(resources[1]);
        P(resources[0]);
        V(resources[0]);
        V(resources[1]);
      }
    `)

    const result = exploreForDeadlock(engine, {
      maxDepth: 10,
      maxStates: 200,
    })

    expect(result.status).toBe('FOUND')
    expect(result.counterexample?.diagnostic.kind).toBe(
      'CIRCULAR_WAIT',
    )
    expect(
      result.counterexample?.diagnostic.involvedResources
        .map((resource) => resource.name),
    ).toEqual(['resources[0]', 'resources[1]'])
  })

  it('clones and rewinds indexed semaphore values independently', () => {
    const engine = createEngine(`
      sem[] gates = [1, 1];

      process Worker {
        P(gates[1]);
      }
    `)
    const fork = engine.fork()

    expect(engine.step()).toBe(true)
    expect(
      engine.getState().program.semaphores?.['gates[1]'].value,
    ).toBe(0)
    expect(
      fork.getState().program.semaphores?.['gates[1]'].value,
    ).toBe(1)

    expect(engine.stepBack()).toBe(true)
    expect(
      engine.getState().program.semaphores?.['gates[1]'].value,
    ).toBe(1)
  })

  it('rejects malformed arrays and duplicate base names', () => {
    expect(() => parseProgram(
      'sem[] gates = [];',
    )).toThrow(
      'Semaphore array must contain at least one value',
    )

    expect(() => parseProgram(
      'sem[] gates = [1, -1];',
    )).toThrow(
      'Expected non-negative integer semaphore value',
    )

    expect(() => parseProgram(`
      sem[] gates = [1, 1];
      sem gates = 1;
    `)).toThrow(
      'Semaphore "gates" is already defined',
    )
  })
})
