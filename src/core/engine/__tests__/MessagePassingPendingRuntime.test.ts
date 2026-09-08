import { describe, expect, it } from 'vitest'
import { parseProgram } from '../../language/parseProgram'
import { FirstReadyScheduler } from '../../scheduler/FirstReadyScheduler'
import { createExecutionState } from '../createExecutionState'
import { SimulationEngine } from '../SimulationEngine'

describe('message passing pending runtime', () => {
  it('fails explicitly instead of advancing a parsed send silently', () => {
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

    expect(() => engine.step()).toThrow(
      'Message passing syntax is available, but its runtime will be implemented in M13.3',
    )
    expect(engine.getState().stepCount).toBe(0)
    expect(
      engine.getState().program.processes[0].programCounter,
    ).toBe(0)
  })
})
