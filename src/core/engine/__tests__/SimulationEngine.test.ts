import { describe, expect, it } from 'vitest'
import { finish, noOp } from '../../instructions/instructionFactories'
import type { Process } from '../../process/Process'
import { FirstReadyScheduler } from '../../scheduler/FirstReadyScheduler'
import { createExecutionState } from '../createExecutionState'
import type { Program } from '../Program'
import { SimulationEngine } from '../SimulationEngine'

function createProcess(
  id: string,
  instructions: Process['instructions'],
): Process {
  return {
    id,
    state: 'READY',
    programCounter: 0,
    instructions,
    localMemory: {},
  }
}

describe('SimulationEngine', () => {
  it('starts with stepCount equal to 0', () => {
    const process = createProcess('P1', [noOp(), finish()])

    const program: Program = {
      processes: [process],
      sharedMemory: {},
    }

    const engine = new SimulationEngine(
      createExecutionState(program),
      new FirstReadyScheduler(),
    )

    expect(engine.getState().stepCount).toBe(0)
  })

  it('executes NO_OP and advances the program counter', () => {
    const process = createProcess('P1', [noOp(), finish()])

    const program: Program = {
      processes: [process],
      sharedMemory: {},
    }

    const engine = new SimulationEngine(
      createExecutionState(program),
      new FirstReadyScheduler(),
    )

    engine.step()

    expect(process.programCounter).toBe(1)
    expect(process.state).toBe('READY')
    expect(engine.getState().stepCount).toBe(1)
  })

  it('finishes a process when FINISH is executed', () => {
    const process = createProcess('P1', [finish()])

    const program: Program = {
      processes: [process],
      sharedMemory: {},
    }

    const engine = new SimulationEngine(
      createExecutionState(program),
      new FirstReadyScheduler(),
    )

    engine.step()

    expect(process.programCounter).toBe(1)
    expect(process.state).toBe('FINISHED')
    expect(engine.getState().stepCount).toBe(1)
  })

  it('reports the program as finished when every process is finished', () => {
    const p1 = createProcess('P1', [finish()])
    const p2 = createProcess('P2', [finish()])

    const program: Program = {
      processes: [p1, p2],
      sharedMemory: {},
    }

    const engine = new SimulationEngine(
      createExecutionState(program),
      new FirstReadyScheduler(),
    )

    expect(engine.isFinished()).toBe(false)

    engine.step()
    expect(engine.isFinished()).toBe(false)

    engine.step()
    expect(engine.isFinished()).toBe(true)
  })

  it('automatically finishes a process after its last instruction', () => {
    const process = createProcess('P1', [noOp()])

    const program: Program = {
      processes: [process],
      sharedMemory: {},
    }

    const engine = new SimulationEngine(
      createExecutionState(program),
      new FirstReadyScheduler(),
    )

    engine.step()

    expect(process.programCounter).toBe(1)
    expect(process.state).toBe('FINISHED')
    expect(engine.isFinished()).toBe(true)
  })

  it('records executed instructions in history', () => {
    const p1 = createProcess('P1', [noOp(), finish()])
    const p2 = createProcess('P2', [noOp(), finish()])

    const program: Program = {
      processes: [p1, p2],
      sharedMemory: {},
    }

    const engine = new SimulationEngine(
      createExecutionState(program),
      new FirstReadyScheduler(),
    )

    engine.step()
    engine.step()
    engine.step()

    expect(engine.getState().history).toEqual([
      {
        step: 1,
        processId: 'P1',
        instructionType: 'NO_OP',
      },
      {
        step: 2,
        processId: 'P1',
        instructionType: 'FINISH',
      },
      {
        step: 3,
        processId: 'P2',
        instructionType: 'NO_OP',
      },
    ])
  })

  it('resets the simulation to its initial state', () => {
    const process = createProcess('P1', [noOp(), finish()])

    const program: Program = {
      processes: [process],
      sharedMemory: {},
    }

    const engine = new SimulationEngine(
      createExecutionState(program),
      new FirstReadyScheduler(),
    )

    engine.step()

    expect(engine.getState().stepCount).toBe(1)

    engine.reset()

    expect(engine.getState().stepCount).toBe(0)
    expect(engine.getState().history).toEqual([])
    expect(engine.getState().program.processes[0].programCounter).toBe(0)
    expect(engine.getState().program.processes[0].state).toBe('READY')
  })

  it('stops executing when the maximum step count is reached', () => {
    const process = createProcess('P1', [
      noOp(),
      noOp(),
      noOp(),
      noOp(),
    ])

    const program: Program = {
      processes: [process],
      sharedMemory: {},
    }

    const engine = new SimulationEngine(
      createExecutionState(program),
      new FirstReadyScheduler(),
      2,
    )

    engine.step()
    engine.step()
    engine.step()

    expect(engine.getState().stepCount).toBe(2)
    expect(engine.hasReachedStepLimit()).toBe(true)
    expect(process.programCounter).toBe(2)
  })
})
