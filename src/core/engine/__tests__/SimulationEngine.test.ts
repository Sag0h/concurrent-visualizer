import { describe, expect, it } from 'vitest'
import { assign, declare, finish, noOp, variableTarget, arrayTarget, ifInstruction, whileInstruction} from '../../instructions/instructionFactories'
import type { Process } from '../../process/Process'
import { FirstReadyScheduler } from '../../scheduler/FirstReadyScheduler'
import { createExecutionState } from '../createExecutionState'
import type { Program } from '../Program'
import { SimulationEngine } from '../SimulationEngine'
import {
  binary,
  literal,
  variable,
} from '../../expressions/expressionFactories'

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
    executionStack: [],
    callStack: [],
    expressionRuntimeStatus: 'IDLE',
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

  it('assigns values to local variables', () => {
    const process = createProcess('P1', [
      assign(variableTarget('x'), {
        type: 'LITERAL',
        value: 10,
      }),
    ])

    process.localMemory.x = 0

    const program: Program = {
      processes: [process],
      sharedMemory: {},
    }

    const engine = new SimulationEngine(
      createExecutionState(program),
      new FirstReadyScheduler(),
    )

    engine.step()

    expect(process.localMemory.x).toBe(10)
  })

  it('assigns values to shared variables', () => {
    const process = createProcess('P1', [
      assign(variableTarget('counter'), {
        type: 'BINARY',
        operator: '+',
        left: {
          type: 'VARIABLE',
          name: 'counter',
        },
        right: {
          type: 'LITERAL',
          value: 1,
        },
      }),
    ])

    const program: Program = {
      processes: [process],
      sharedMemory: {
        counter: 0,
      },
    }

    const engine = new SimulationEngine(
      createExecutionState(program),
      new FirstReadyScheduler(),
    )

    engine.step()

    expect(program.sharedMemory.counter).toBe(1)
  })

  it('assigns to local memory when a variable shadows shared memory', () => {
    const process = createProcess('P1', [
      assign(variableTarget('x'), {
        type: 'LITERAL',
        value: 20,
      }),
    ])

    process.localMemory.x = 1

    const program: Program = {
      processes: [process],
      sharedMemory: {
        x: 100,
      },
    }

    const engine = new SimulationEngine(
      createExecutionState(program),
      new FirstReadyScheduler(),
    )

    engine.step()

    expect(process.localMemory.x).toBe(20)
    expect(program.sharedMemory.x).toBe(100)
  })

  it('declares a local variable', () => {
    const process = createProcess('P1', [
      declare('LOCAL', 'x', literal(10)),
    ])

    const program: Program = {
      processes: [process],
      sharedMemory: {},
    }

    const engine = new SimulationEngine(
      createExecutionState(program),
      new FirstReadyScheduler(),
    )

    engine.step()

    expect(process.localMemory.x).toBe(10)
  })

  it('declares a shared variable', () => {
    const process = createProcess('P1', [
      declare('SHARED', 'counter', literal(0)),
    ])

    const program: Program = {
      processes: [process],
      sharedMemory: {},
    }

    const engine = new SimulationEngine(
      createExecutionState(program),
      new FirstReadyScheduler(),
    )

    engine.step()

    expect(program.sharedMemory.counter).toBe(0)
  })

  it('executes declarations and assignments sequentially', () => {
    const process = createProcess('P1', [
      declare('LOCAL', 'x', literal(5)),
      assign(
        variableTarget('x'),
        binary(
          '+',
          variable('x'),
          literal(3),
        ),
      ),
      finish(),
    ])

    const program: Program = {
      processes: [process],
      sharedMemory: {},
    }

    const engine = new SimulationEngine(
      createExecutionState(program),
      new FirstReadyScheduler(),
    )

    engine.step()
    expect(process.localMemory.x).toBe(5)

    engine.step()
    expect(process.localMemory.x).toBe(8)

    engine.step()
    expect(process.state).toBe('FINISHED')
  })

  it('assigns a value to an array element', () => {
    const process = createProcess('P1', [
      assign(
        arrayTarget(
          'numbers',
          literal(1),
        ),
        literal(50),
      ),
    ])

    process.localMemory.numbers = [10, 20, 30]

    const program: Program = {
      processes: [process],
      sharedMemory: {},
    }

    const engine = new SimulationEngine(
      createExecutionState(program),
      new FirstReadyScheduler(),
    )

    engine.step()

    expect(process.localMemory.numbers).toEqual([
      10,
      50,
      30,
    ])
  })

  it('assigns to an array using a variable index', () => {
    const process = createProcess('P1', [
      assign(
        arrayTarget(
          'numbers',
          variable('i'),
        ),
        literal(99),
      ),
    ])

    process.localMemory.numbers = [10, 20, 30]
    process.localMemory.i = 2

    const program: Program = {
      processes: [process],
      sharedMemory: {},
    }

    const engine = new SimulationEngine(
      createExecutionState(program),
      new FirstReadyScheduler(),
    )

    engine.step()

    expect(process.localMemory.numbers).toEqual([
      10,
      20,
      99,
    ])
  })

  it('exposes a simulation snapshot for visualization', () => {
    const process = createProcess('P1', [
      declare('LOCAL', 'x', literal(5)),
    ])

    const program: Program = {
      processes: [process],
      sharedMemory: {
        counter: 10,
      },
    }

    const engine = new SimulationEngine(
      createExecutionState(program),
      new FirstReadyScheduler(),
    )

    engine.step()

    expect(engine.getSnapshot()).toEqual({
      stepCount: 1,

      sharedMemory: {
        counter: 10,
      },

      processes: [
        {
          id: 'P1',
          state: 'FINISHED',
          programCounter: 1,
          localMemory: {
            x: 5,
          },
          callStack: [],
        },
      ],
    })
  })

  it('returns memory copies in the visualization snapshot', () => {
    const process = createProcess('P1', [])

    process.localMemory.x = 1

    const program: Program = {
      processes: [process],
      sharedMemory: {
        counter: 2,
      },
    }

    const engine = new SimulationEngine(
      createExecutionState(program),
      new FirstReadyScheduler(),
    )

    const snapshot = engine.getSnapshot()

    snapshot.sharedMemory.counter = 999
    snapshot.processes[0].localMemory.x = 999

    expect(
      engine.getState().program.sharedMemory.counter,
    ).toBe(2)

    expect(
      engine.getState().program.processes[0].localMemory.x,
    ).toBe(1)
  })

  it('executes the then branch of an IF', () => {
    const process = createProcess('P1', [
      declare(
        'LOCAL',
        'x',
        literal(10),
      ),
      ifInstruction(
        binary(
          '>',
          variable('x'),
          literal(5),
        ),
        [
          assign(
            variableTarget('x'),
            literal(100),
          ),
        ],
        [
          assign(
            variableTarget('x'),
            literal(200),
          ),
        ],
      ),
    ])

    const program: Program = {
      processes: [process],
      sharedMemory: {},
    }

    const engine = new SimulationEngine(
      createExecutionState(program),
      new FirstReadyScheduler(),
    )

    engine.step()
    expect(process.localMemory.x).toBe(10)

    engine.step()
    expect(process.localMemory.x).toBe(10)

    engine.step()
    expect(process.localMemory.x).toBe(100)

    expect(process.state).toBe('FINISHED')
  })

  it('executes a WHILE loop until its condition becomes false', () => {
    const process = createProcess('P1', [
      declare(
        'LOCAL',
        'x',
        literal(0),
      ),
      whileInstruction(
        binary(
          '<',
          variable('x'),
          literal(3),
        ),
        [
          assign(
            variableTarget('x'),
            binary(
              '+',
              variable('x'),
              literal(1),
            ),
          ),
        ],
      ),
    ])

    const program: Program = {
      processes: [process],
      sharedMemory: {},
    }

    const engine = new SimulationEngine(
      createExecutionState(program),
      new FirstReadyScheduler(),
    )

    while (!engine.isFinished()) {
      engine.step()
    }

    expect(process.localMemory.x).toBe(3)
    expect(process.state).toBe('FINISHED')
  })
})
