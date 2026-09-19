import { describe, expect, it } from 'vitest'
import { parseProgram } from '../../language/parseProgram'
import { FirstReadyScheduler } from '../../scheduler/FirstReadyScheduler'
import { createExecutionState } from '../createExecutionState'
import { SimulationEngine } from '../SimulationEngine'

describe('message passing pending runtime', () => {
  it('executes send while receive remains pending', () => {
    const program = parseProgram(`
      chan jobs(int);
      process Producer {
        send jobs(10);
      }
    `)
    const engine = new SimulationEngine(
      createExecutionState(program),
      new FirstReadyScheduler(),
    )

    expect(engine.step()).toBe(true)
    expect(engine.getState().stepCount).toBe(1)
    expect(
      engine.getState().program.processes[0].programCounter,
    ).toBe(1)
    expect(engine.getState().channelStates?.jobs.messages)
      .toEqual([{ values: [10] }])
  })

  it('fails explicitly when empty needs channel runtime state', () => {
    const program = parseProgram(`
      chan jobs(int);
      process Observer {
        bool result = empty(jobs);
      }
    `)
    const engine = new SimulationEngine(
      createExecutionState(program),
      new FirstReadyScheduler(),
    )

    expect(() => engine.step()).toThrow(
      'Message passing syntax is available, but its runtime will be implemented in M13.3',
    )
    expect(engine.getState().stepCount).toBe(0)
    expect(
      engine.getState().program.processes[0].programCounter,
    ).toBe(0)
  })
})
