import { describe, expect, it } from 'vitest'
import { parseProgram } from '../../language/parseProgram'
import { FirstReadyScheduler } from '../../scheduler/FirstReadyScheduler'
import { RoundRobinScheduler } from '../../scheduler/RoundRobinScheduler'
import { createExecutionState } from '../createExecutionState'
import { SimulationEngine } from '../SimulationEngine'

function createEngine(
  source: string,
  roundRobin = false,
): SimulationEngine {
  return new SimulationEngine(
    createExecutionState(parseProgram(source)),
    roundRobin
      ? new RoundRobinScheduler()
      : new FirstReadyScheduler(),
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

  throw new Error('Monitor program did not finish')
}

describe('monitor runtime', () => {
  const counterProgram = `
    monitor Counter {
      int value = 0;

      procedure increment() {
        int observed = value;
        value = observed + 1;
      }
    }

    process P1 { Counter.increment(); }
    process P2 { Counter.increment(); }
  `

  it('parses private state, procedures and qualified calls', () => {
    const program = parseProgram(counterProgram)

    expect(program.monitors?.Counter).toMatchObject({
      name: 'Counter',
      state: [{ name: 'value' }],
      procedures: {
        increment: {
          name: 'increment',
          parameters: [],
        },
      },
    })
    expect(program.processes[0].instructions[0]).toMatchObject({
      type: 'MONITOR_PROCEDURE_CALL',
      monitorName: 'Counter',
      procedureName: 'increment',
      arguments: [],
    })
  })

  it('provides implicit mutual exclusion for the entire procedure', () => {
    const engine = createEngine(counterProgram, true)

    engine.step()
    expect(engine.getSnapshot().monitors[0]).toMatchObject({
      name: 'Counter',
      ownerProcessId: 'P1',
      memory: { value: 0 },
    })

    engine.step()
    expect(engine.getState().program.processes[1]).toMatchObject({
      state: 'BLOCKED',
      blockingReason: {
        type: 'MONITOR_ENTRY',
        monitorName: 'Counter',
      },
    })
    expect(engine.getSnapshot().monitors[0]
      .entryContenderProcessIds).toEqual(['P2'])

    runToCompletion(engine)

    expect(engine.getState().monitorStates?.Counter.memory.value)
      .toBe(2)
    expect(engine.getSnapshot().monitors[0]).toMatchObject({
      ownerProcessId: undefined,
      entryContenderProcessIds: [],
      memory: { value: 2 },
    })
    expect(engine.getState().program.sharedMemory).toEqual({})
    expect(engine.getState().program.processes[0].localMemory)
      .toEqual({})
    expect(engine.getState().history.some(
      (event) => event.description?.includes(
        'blocked: monitor owned by P1',
      ),
    )).toBe(true)
  })

  it('restores monitor ownership and memory with reset and step back', () => {
    const engine = createEngine(counterProgram)

    engine.step()
    engine.step()
    engine.step()

    expect(engine.getState().monitorStates?.Counter.memory.value)
      .toBe(1)

    expect(engine.stepBack()).toBe(true)
    expect(engine.getState().monitorStates?.Counter.memory.value)
      .toBe(0)
    expect(engine.getState().monitorStates?.Counter.ownerProcessId)
      .toBe('P1')

    engine.reset()
    expect(engine.getState().monitorStates?.Counter).toMatchObject({
      memory: { value: 0 },
      entryContenderProcessIds: [],
    })
    expect(engine.getState().monitorStates?.Counter.ownerProcessId)
      .toBeUndefined()
  })

  it('rejects unsupported parameters and unknown procedures precisely', () => {
    expect(() => parseProgram(`
      monitor Counter {
        int value = 0;
        procedure add(in int amount) { }
      }
      process P1 { }
    `)).toThrow(
      'Monitor procedure parameters are not executable yet',
    )

    expect(() => parseProgram(`
      monitor Counter {
        int value = 0;
        procedure increment() { value = value + 1; }
      }
      process P1 { Counter.missing(); }
    `)).toThrow(
      'Monitor "Counter" has no procedure "missing"',
    )
  })
})
