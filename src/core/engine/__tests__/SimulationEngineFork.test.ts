import { describe, expect, it } from 'vitest'
import { parseProgram } from '../../language/parseProgram'
import { FirstReadyScheduler } from '../../scheduler/FirstReadyScheduler'
import { RoundRobinScheduler } from '../../scheduler/RoundRobinScheduler'
import type { Scheduler } from '../../scheduler/Scheduler'
import { createExecutionState } from '../createExecutionState'
import { SimulationEngine } from '../SimulationEngine'
import { isQueueValue } from '../../memory/RuntimeValue'

function createEngine(
  source: string,
  scheduler: Scheduler = new FirstReadyScheduler(),
): SimulationEngine {
  return new SimulationEngine(
    createExecutionState(parseProgram(source)),
    scheduler,
  )
}

function executeSelected(
  engine: SimulationEngine,
  processId: string,
): void {
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

  engine.stepTransition(transition)
}

function runExplicitly(
  engine: SimulationEngine,
  processId: string,
  maximumSteps = 100,
): void {
  for (let step = 0; step < maximumSteps; step++) {
    if (engine.isFinished()) {
      return
    }

    executeSelected(engine, processId)
  }

  throw new Error(
    `Fork did not finish after ${maximumSteps} steps`,
  )
}

describe('SimulationEngine fork', () => {
  it('clones shared FIFO queues without sharing their items', () => {
    const engine = createEngine(`
      shared queue<int> jobs = queue[1];

      process Producer {
        jobs.enqueue(2);
      }
    `)
    const fork = engine.fork()

    executeSelected(fork, 'Producer')

    const originalQueue =
      engine.getState().program.sharedMemory.jobs
    const forkQueue =
      fork.getState().program.sharedMemory.jobs

    if (
      !isQueueValue(originalQueue)
      || !isQueueValue(forkQueue)
    ) {
      throw new Error('Expected jobs to be a queue')
    }

    expect(originalQueue.items).toEqual([1])
    expect(forkQueue.items).toEqual([1, 2])
    expect(originalQueue.items).not.toBe(
      forkQueue.items,
    )
  })

  it('clones an in-progress shared-memory micro-operation independently', () => {
    const engine = createEngine(`
      shared int x = 0;

      process P1 {
        x = x + 1;
      }
    `)

    executeSelected(engine, 'P1')

    const fork = engine.fork()

    executeSelected(fork, 'P1')
    executeSelected(fork, 'P1')

    expect(fork.getState().program.sharedMemory.x).toBe(1)
    expect(fork.getState().stepCount).toBe(3)
    expect(fork.getState().microOperationHistory).toHaveLength(3)

    expect(engine.getState().program.sharedMemory.x).toBe(0)
    expect(engine.getState().stepCount).toBe(1)
    expect(engine.getState().microOperationHistory).toHaveLength(1)
    expect(engine.isFinished()).toBe(false)
  })

  it('clones suspended function evaluation state independently', () => {
    const engine = createEngine(`
      function double(int value) {
        return value * 2;
      }

      process P1 {
        int result = double(21);
      }
    `)

    executeSelected(engine, 'P1')

    const originalProcess =
      engine.getState().program.processes[0]

    expect(originalProcess.pendingEvaluations.length).toBeGreaterThan(0)

    const fork = engine.fork()

    runExplicitly(fork, 'P1')

    expect(
      fork.getState().program.processes[0].localMemory.result,
    ).toBe(42)
    expect(
      fork.getState().program.processes[0].pendingEvaluations,
    ).toEqual([])

    expect(originalProcess.localMemory.result).toBeUndefined()
    expect(originalProcess.pendingEvaluations.length).toBeGreaterThan(0)
    expect(engine.isFinished()).toBe(false)
  })

  it('clones active loop frames without sharing their program counters', () => {
    const engine = createEngine(`
      process P1 {
        int index = 0;

        while (index < 2) {
          index = index + 1;
        }
      }
    `)

    executeSelected(engine, 'P1')
    executeSelected(engine, 'P1')

    const originalProcess =
      engine.getState().program.processes[0]
    const fork = engine.fork()

    executeSelected(fork, 'P1')

    expect(
      fork.getState().program.processes[0].localMemory.index,
    ).toBe(1)
    expect(originalProcess.localMemory.index).toBe(0)
    expect(originalProcess.executionStack).toHaveLength(1)
    expect(
      originalProcess.executionStack[0].programCounter,
    ).toBe(0)
  })

  it('resets a fork to its branch point without affecting the original', () => {
    const engine = createEngine(`
      shared int x = 0;

      process P1 {
        x = x + 1;
      }
    `)

    executeSelected(engine, 'P1')

    const fork = engine.fork()

    executeSelected(fork, 'P1')
    fork.reset()

    expect(fork.getState()).toEqual(engine.getState())
    expect(fork.getState()).not.toBe(engine.getState())
    expect(fork.getState().program).not.toBe(
      engine.getState().program,
    )
  })

  it('preserves the Round Robin cursor in each independent fork', () => {
    const engine = createEngine(`
      process P1 {
        while (true) { }
      }

      process P2 {
        while (true) { }
      }

      process P3 {
        while (true) { }
      }
    `, new RoundRobinScheduler())

    engine.step()

    const fork = engine.fork()

    engine.step()
    fork.step()

    expect(engine.getState().history.at(-1)?.processId).toBe('P2')
    expect(fork.getState().history.at(-1)?.processId).toBe('P2')

    fork.step()

    expect(fork.getState().history.at(-1)?.processId).toBe('P3')
    expect(engine.getState().history.at(-1)?.processId).toBe('P2')
  })
})
