import { describe, expect, it } from 'vitest'
import { createSemanticStateKey } from '../../exploration/createSemanticStateKey'
import { parseProgram } from '../../language/parseProgram'
import { FirstReadyScheduler } from '../../scheduler/FirstReadyScheduler'
import { RoundRobinScheduler } from '../../scheduler/RoundRobinScheduler'
import { createExecutionState } from '../createExecutionState'
import type { EnabledTransition } from '../EnabledTransition'
import { SimulationEngine } from '../SimulationEngine'

function createEngine(source: string): SimulationEngine {
  return new SimulationEngine(
    createExecutionState(parseProgram(source)),
    new FirstReadyScheduler(),
    200,
  )
}

function transitionFor(
  engine: SimulationEngine,
  processId: string,
): EnabledTransition {
  const transition = engine
    .getEnabledTransitions()
    .find((candidate) => candidate.processId === processId)

  if (!transition) {
    throw new Error(`Expected ${processId} to be enabled`)
  }

  return transition
}

function exploreFinalX(
  source: string,
  maximumDepth = 80,
  maximumStates = 5_000,
): number[] {
  const initialEngine = createEngine(source)
  const queue = [{ engine: initialEngine, depth: 0 }]
  const visited = new Set<string>([
    createSemanticStateKey(initialEngine.getState()),
  ])
  const finalValues = new Set<number>()

  for (let queueIndex = 0; queueIndex < queue.length; queueIndex++) {
    const node = queue[queueIndex]

    if (node.engine.isFinished()) {
      const value = node.engine.getState().program.sharedMemory.x

      if (typeof value !== 'number') {
        throw new Error('Expected shared x to be numeric')
      }

      finalValues.add(value)
      continue
    }

    if (node.depth >= maximumDepth) {
      throw new Error('Academic exploration reached its depth limit')
    }

    for (const transition of node.engine.getEnabledTransitions()) {
      const child = node.engine.fork()
      child.stepTransition(transition)

      const stateKey = createSemanticStateKey(child.getState())

      if (visited.has(stateKey)) {
        continue
      }

      visited.add(stateKey)

      if (visited.size > maximumStates) {
        throw new Error('Academic exploration reached its state limit')
      }

      queue.push({
        engine: child,
        depth: node.depth + 1,
      })
    }
  }

  return [...finalValues].sort((left, right) => left - right)
}

describe('academic expression granularity', () => {
  it('reproduces an interleaved argument read with Round Robin', () => {
    const source = `
      shared int x = 1;

      function delay(int value) {
        int copy = value;
        return copy;
      }

      function add(int left, int right) {
        return left + right;
      }

      process Reader {
        x = add(delay(x), x);
      }

      process Writer {
        x = 10;
      }
    `
    const engine = new SimulationEngine(
      createExecutionState(parseProgram(source)),
      new RoundRobinScheduler(),
      100,
    )

    while (!engine.isFinished()) {
      engine.step()
    }

    expect(engine.getState().program.sharedMemory.x).toBe(11)
  })

  it('allows function arguments to observe shared memory independently', () => {
    const finalValues = exploreFinalX(`
      shared int x = 1;

      function add(int left, int right) {
        return left + right;
      }

      process Reader {
        x = add(x, x);
      }

      process Writer {
        x = 10;
      }
    `)

    expect(finalValues).toEqual([2, 10, 11, 20])
  })

  it('records function argument reads and the resumed shared write', () => {
    const engine = createEngine(`
      shared int x = 1;

      function add(int left, int right) {
        return left + right;
      }

      process Reader {
        x = add(x, x);
      }

      process Writer {
        x = 10;
      }
    `)

    engine.stepTransition(transitionFor(engine, 'Reader'))
    engine.stepTransition(transitionFor(engine, 'Writer'))
    engine.stepTransition(transitionFor(engine, 'Writer'))
    engine.stepTransition(transitionFor(engine, 'Reader'))

    while (!engine.isFinished()) {
      const readerTransition = engine
        .getEnabledTransitions()
        .find((transition) => transition.processId === 'Reader')

      if (!readerTransition) {
        break
      }

      engine.stepTransition(readerTransition)
    }

    const readerMicroOperations = (
      engine.getState().microOperationHistory ?? []
    ).filter((event) => event.processId === 'Reader')

    expect(
      readerMicroOperations.map((event) => event.type),
    ).toEqual([
      'SHARED_READ',
      'SHARED_READ',
      'COMPUTE',
      'SHARED_WRITE',
    ])
    expect(
      readerMicroOperations.map((event) => event.description),
    ).toEqual([
      'x = 1',
      'x = 10',
      'result = 11',
      'x = 11',
    ])
  })

  it('clones a suspended argument evaluation independently', () => {
    const engine = createEngine(`
      shared int x = 1;

      function add(int left, int right) {
        return left + right;
      }

      process Reader {
        x = add(x, x);
      }
    `)

    engine.stepTransition(transitionFor(engine, 'Reader'))

    const fork = engine.fork()
    fork.getState().program.sharedMemory.x = 99

    while (!engine.isFinished()) {
      engine.stepTransition(transitionFor(engine, 'Reader'))
    }

    while (!fork.isFinished()) {
      fork.stepTransition(transitionFor(fork, 'Reader'))
    }

    expect(engine.getState().program.sharedMemory.x).toBe(2)
    expect(fork.getState().program.sharedMemory.x).toBe(100)
  })

  it('reads nested function arguments from left to right', () => {
    const engine = createEngine(`
      shared int x = 2;

      function add(int left, int right) {
        return left + right;
      }

      process Reader {
        x = add(add(x, x), x);
      }
    `)

    while (!engine.isFinished()) {
      engine.stepTransition(transitionFor(engine, 'Reader'))
    }

    expect(engine.getState().program.sharedMemory.x).toBe(6)
    expect(
      (engine.getState().microOperationHistory ?? [])
        .map((event) => event.type),
    ).toEqual([
      'SHARED_READ',
      'SHARED_READ',
      'SHARED_READ',
      'COMPUTE',
      'SHARED_WRITE',
    ])
  })

  it('preserves the reachable values of the reported academic case', () => {
    const finalValues = exploreFinalX(`
      shared int x = 0;
      shared int y = 0;

      function mult(int a, int b) {
        return a * b;
      }

      process P1 {
        if (x == 0) {
          y = 4 * 2;
          x = y + 2;
        }
      }

      process P2 {
        if (x > 0) {
          x = mult(x, 3) + mult(x, 2) + 1;
        }
      }

      process P3 {
        x = x * 3;
      }
    `)

    expect(finalValues).toEqual([
      0,
      1,
      10,
      30,
      31,
      51,
      91,
      151,
      153,
    ])
  })
})
