import { describe, expect, it } from 'vitest'
import { parseProgram } from '../../language/parseProgram'
import { RoundRobinScheduler } from '../../scheduler/RoundRobinScheduler'
import { createExecutionState } from '../createExecutionState'
import { SimulationEngine } from '../SimulationEngine'

function createEngine(source: string): SimulationEngine {
  return new SimulationEngine(
    createExecutionState(parseProgram(source)),
    new RoundRobinScheduler(),
  )
}

function runToCompletion(
  engine: SimulationEngine,
  maximumSteps = 200,
): void {
  for (let step = 0; step < maximumSteps; step++) {
    if (engine.isFinished()) {
      return
    }

    engine.step()
  }

  throw new Error(
    `Parameterized program did not finish after ${maximumSteps} steps`,
  )
}

describe('parameterized processes', () => {
  it('executes every expanded process with an independent local index', () => {
    const engine = createEngine(`
      shared int[] results = [0, 0, 0, 0];

      process Controller[i:0..3] {
        int local = i + 10;
        results[i] = local;
      }
    `)

    runToCompletion(engine)

    expect(engine.getState().program.sharedMemory.results).toEqual([
      10,
      11,
      12,
      13,
    ])
    expect(engine.getState().program.processes.map(
      (process) => ({
        id: process.id,
        index: process.localMemory.i,
        local: process.localMemory.local,
        state: process.state,
      }),
    )).toEqual([
      {
        id: 'Controller[0]',
        index: 0,
        local: 10,
        state: 'FINISHED',
      },
      {
        id: 'Controller[1]',
        index: 1,
        local: 11,
        state: 'FINISHED',
      },
      {
        id: 'Controller[2]',
        index: 2,
        local: 12,
        state: 'FINISHED',
      },
      {
        id: 'Controller[3]',
        index: 3,
        local: 13,
        state: 'FINISHED',
      },
    ])
  })

  it('exposes every generated process as an independent transition', () => {
    const engine = createEngine(`
      process Worker[i:0..2] {
        int copy = i;
      }
    `)

    expect(engine.getEnabledTransitions().map(
      (transition) => transition.processId,
    )).toEqual([
      'Worker[0]',
      'Worker[1]',
      'Worker[2]',
    ])

    const fork = engine.fork()
    const selected = fork.getEnabledTransitions()[1]
    fork.stepTransition(selected)

    expect(fork.getState().program.processes[1].state).toBe('FINISHED')
    expect(fork.getState().program.processes[1].localMemory).toEqual({
      i: 1,
      copy: 1,
    })
    expect(engine.getState().program.processes[1].state).toBe('READY')
    expect(engine.getState().program.processes[1].localMemory).toEqual({
      i: 1,
    })
  })
})
