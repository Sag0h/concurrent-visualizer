import { describe, expect, it } from 'vitest'
import { assign, declare, finish, noOp, variableTarget, arrayTarget, ifInstruction, whileInstruction, awaitInstruction} from '../../instructions/instructionFactories'
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

import { parseProgram } from '../../language/parseProgram'
import { RoundRobinScheduler } from '../../scheduler/RoundRobinScheduler'

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
    pendingEvaluations: [],
    atomicDepth: 0,
  }
}

function runSourceProgram(
  source: string,
  maxSteps = 1000,
): Program {
  const program = parseProgram(source)

  const engine = new SimulationEngine(
    createExecutionState(program),
    new FirstReadyScheduler(),
    maxSteps,
  )

  while (!engine.isFinished()) {
    const progressed = engine.step()

    if (!progressed) {
      break
    }
  }

  if (!engine.isFinished()) {
    throw new Error(
      `Program did not finish after ${engine.getState().stepCount} steps`,
    )
  }

  return engine.getState().program
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

  it('assigns values to shared variables through micro-operations', () => {
    const program = {
      sharedMemory: {
        counter: 0,
      },
      processes: [
        createProcess('P1', [
          {
            type: 'ASSIGN',
            target: {
              type: 'VARIABLE',
              name: 'counter',
            },
            expression: {
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
            },
          },
        ]),
      ],
    }

    const engine = new SimulationEngine(
      {
        program,
        history: [],
        stepCount: 0,
      },
      new FirstReadyScheduler(),
    )

    engine.step()
    expect(program.sharedMemory.counter).toBe(0)

    engine.step()
    expect(program.sharedMemory.counter).toBe(0)

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
      executionStatus: 'FINISHED',
      executionFocus: {
        step: 1,
        processId: 'P1',
        instructionType: 'DECLARE',
        description: undefined,
        microOperation: undefined,
      },
      deadlock: undefined,
      runtimeDiagnostics: [],
      sharedMemory: {
        counter: 10,
      },
      semaphores: [],
      
      microOperationHistory: [],
      memoryAccessConflicts: [],
      memoryConflictSummaries: [],
      processes: [
        {
          id: 'P1',
          state: 'FINISHED',
          programCounter: 1,
          localMemory: {
            x: 5,
          },
          callStack: [],
          blockingReason: undefined,
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

  it('evaluates nested function calls inside return expressions', () => {
    const program = runSourceProgram(`
      shared int result = 0;

      function double(int value) {
        return value * 2;
      }

      function calculate(int value) {
        return double(value) + 1;
      }

      process P1 {
        result = calculate(5);
      }
    `)

    expect(program.sharedMemory.result).toBe(11)
  })

  it('evaluates function calls in multiple call arguments', () => {
    const program = runSourceProgram(`
      shared int result = 0;

      function double(int value) {
        return value * 2;
      }

      function addAndSave(int a, int b) {
        result = a + b;
      }

      process P1 {
        addAndSave(
          double(5),
          double(10)
        );
      }
    `)

    expect(program.sharedMemory.result).toBe(30)
  })
    
  it('evaluates deeply nested function call expressions', () => {
    const program = runSourceProgram(`
      shared int result = 0;

      function double(int value) {
        return value * 2;
      }

      process P1 {
        result = double(double(5));
      }
    `)

    expect(program.sharedMemory.result).toBe(20)
  })

  it('evaluates a function call used as a foreach collection', () => {
    const program = runSourceProgram(`
      shared int total = 0;

      function getValues() {
        return [10, 20, 30];
      }

      process P1 {
        foreach (value in getValues()) {
          total = total + value;
        }
      }
    `)

    expect(program.sharedMemory.total).toBe(60)
  })

  it('evaluates function calls in array assignment index and value', () => {
    const program = runSourceProgram(`
      shared int result = 0;

      function getIndex() {
        return 1;
      }

      function calculate() {
        return 100;
      }

      process P1 {
        int[] values = [10, 20, 30];

        values[getIndex()] = calculate();

        result = values[1];
      }
    `)

    expect(program.sharedMemory.result).toBe(100)
  })

  it('evaluates a function call in an empty repeat-until condition', () => {
    const program = runSourceProgram(`
      shared int checks = 0;

      function ready() {
        checks = checks + 1;
        return checks >= 3;
      }

      process P1 {
        repeat {
        } until (ready());
      }
    `)

    expect(program.sharedMemory.checks).toBe(3)
  })

  it('evaluates a function call in a for condition', () => {
    const program = runSourceProgram(`
      shared int total = 0;

      function canContinue(int value) {
        return value < 4;
      }

      process P1 {
        for (
          int i = 0;
          canContinue(i);
          i = i + 1
        ) {
          total = total + i;
        }
      }
    `)

    expect(program.sharedMemory.total).toBe(6)
  })

  it('keeps suspended expression state isolated between processes', () => {
    const program = runSourceProgram(`
      shared int result1 = 0;
      shared int result2 = 0;

      function double(int value) {
        return value * 2;
      }

      function calculate(int value) {
        return double(value) + 1;
      }

      process P1 {
        result1 = calculate(5);
      }

      process P2 {
        result2 = calculate(10);
      }
    `)

    expect(program.sharedMemory.result1).toBe(11)
    expect(program.sharedMemory.result2).toBe(21)

    expect(
      program.processes[0].pendingEvaluations,
    ).toEqual([])

    expect(
      program.processes[1].pendingEvaluations,
    ).toEqual([])
  })

    it('allows a lost update through interleaved shared-memory micro-operations', () => {
    const source = `
      shared int x = 0;

      process P1 {
        x = x + 1;
      }

      process P2 {
        x = x + 1;
      }
    `

    const program = parseProgram(source)

    const engine = new SimulationEngine(
      createExecutionState(program),
      new RoundRobinScheduler(),
    )

    while (!engine.isFinished()) {
      const progressed = engine.step()

      if (!progressed) {
        break
      }
    }

    expect(program.sharedMemory.x).toBe(1)

    expect(
      engine
        .getState()
        .microOperationHistory
        ?.map((event) => ({
          processId: event.processId,
          type: event.type,
          description: event.description,
        })),
    ).toEqual([
      {
        processId: 'P1',
        type: 'SHARED_READ',
        description: 'x = 0',
      },
      {
        processId: 'P2',
        type: 'SHARED_READ',
        description: 'x = 0',
      },
      {
        processId: 'P1',
        type: 'COMPUTE',
        description: 'result = 1',
      },
      {
        processId: 'P2',
        type: 'COMPUTE',
        description: 'result = 1',
      },
      {
        processId: 'P1',
        type: 'SHARED_WRITE',
        description: 'x = 1',
      },
      {
        processId: 'P2',
        type: 'SHARED_WRITE',
        description: 'x = 1',
      },
    ])
  })

  it('exposes micro-operation history in the simulation snapshot', () => {
    const source = `
      shared int x = 0;

      process P1 {
        x = x + 1;
      }
    `

    const program = parseProgram(source)

    const engine = new SimulationEngine(
      createExecutionState(program),
      new FirstReadyScheduler(),
    )

    engine.step()
    engine.step()
    engine.step()

    const snapshot = engine.getSnapshot()

    expect(snapshot.microOperationHistory).toEqual([
      {
        step: 1,
        processId: 'P1',
        type: 'SHARED_READ',
        description: 'x = 0',
        location: {
          type: 'VARIABLE',
          name: 'x',
        },
        atomicDepth: 0,
      },
      {
        step: 2,
        processId: 'P1',
        type: 'COMPUTE',
        description: 'result = 1',
        location: undefined,
        atomicDepth: 0,
      },
      {
        step: 3,
        processId: 'P1',
        type: 'SHARED_WRITE',
        description: 'x = 1',
        location: {
          type: 'VARIABLE',
          name: 'x',
        },
        atomicDepth: 0,
      },
    ])
    expect(snapshot.executionFocus).toEqual({
      step: 3,
      processId: 'P1',
      instructionType: 'ASSIGN',
      description: undefined,
      microOperation: {
        step: 3,
        processId: 'P1',
        type: 'SHARED_WRITE',
        description: 'x = 1',
        location: {
          type: 'VARIABLE',
          name: 'x',
        },
        atomicDepth: 0,
      },
    })
  })

  it('records shared memory locations structurally in micro-operation history', () => {
    const source = `
      shared int counter = 0;
      shared int[] values = [10, 20];

      process P1 {
        counter = counter + 1;
        values[1] = values[1] + 5;
      }
    `

    const program = parseProgram(source)

    const engine = new SimulationEngine(
      createExecutionState(program),
      new FirstReadyScheduler(),
    )

    while (!engine.isFinished()) {
      const progressed = engine.step()

      if (!progressed) {
        break
      }
    }

    const memoryEvents =
      engine
        .getState()
        .microOperationHistory
        ?.filter(
          (event) =>
            event.type === 'SHARED_READ'
            || event.type === 'SHARED_WRITE',
        )

    expect(
      memoryEvents?.map((event) => ({
        type: event.type,
        location: event.location,
      })),
    ).toEqual([
      {
        type: 'SHARED_READ',
        location: {
          type: 'VARIABLE',
          name: 'counter',
        },
      },
      {
        type: 'SHARED_WRITE',
        location: {
          type: 'VARIABLE',
          name: 'counter',
        },
      },
      {
        type: 'SHARED_READ',
        location: {
          type: 'ARRAY_ELEMENT',
          arrayName: 'values',
          index: 1,
        },
      },
      {
        type: 'SHARED_WRITE',
        location: {
          type: 'ARRAY_ELEMENT',
          arrayName: 'values',
          index: 1,
        },
      },
    ])
  })

  it('prevents interleaving inside atomic sections', () => {
    const source = `
      shared int x = 0;

      process P1 {
        atomic {
          x = x + 1;
        }
      }

      process P2 {
        atomic {
          x = x + 1;
        }
      }
    `

    const program = parseProgram(source)

    const engine = new SimulationEngine(
      createExecutionState(program),
      new RoundRobinScheduler(),
    )

    while (!engine.isFinished()) {
      const progressed = engine.step()

      if (!progressed) {
        break
      }
    }

    expect(program.sharedMemory.x).toBe(2)
  })

  it('executes shared-memory micro-operations without switching process inside atomic', () => {
    const source = `
      shared int x = 0;

      process P1 {
        atomic {
          x = x + 1;
        }
      }

      process P2 {
        atomic {
          x = x + 1;
        }
      }
    `

    const program = parseProgram(source)

    const engine = new SimulationEngine(
      createExecutionState(program),
      new RoundRobinScheduler(),
    )

    while (!engine.isFinished()) {
      const progressed = engine.step()

      if (!progressed) {
        break
      }
    }

    const memoryOperations =
      engine
        .getState()
        .microOperationHistory
        ?.filter(
          (event) =>
            event.type === 'SHARED_READ'
            || event.type === 'SHARED_WRITE'
            || event.type === 'COMPUTE',
        )

    expect(
      memoryOperations?.map(
        (event) => event.processId,
      ),
    ).toEqual([
      'P1',
      'P1',
      'P1',
      'P2',
      'P2',
      'P2',
    ])

    expect(
      memoryOperations?.map(
        (event) => event.description,
      ),
    ).toEqual([
      'x = 0',
      'result = 1',
      'x = 1',
      'x = 1',
      'result = 2',
      'x = 2',
    ])
  })

  it('supports nested atomic sections without leaving atomic depth active', () => {
    const source = `
      shared int x = 0;

      process P1 {
        atomic {
          x = x + 1;

          atomic {
            x = x + 1;
          }

          x = x + 1;
        }
      }

      process P2 {
        atomic {
          x = x + 100;
        }
      }
    `

    const program = parseProgram(source)

    const engine = new SimulationEngine(
      createExecutionState(program),
      new RoundRobinScheduler(),
    )

    while (!engine.isFinished()) {
      const progressed = engine.step()

      if (!progressed) {
        break
      }
    }

    expect(engine.isFinished()).toBe(true)
    expect(
      engine.getState().program.sharedMemory.x,
    ).toBe(103)

    for (
      const process
      of engine.getState().program.processes
    ) {
      expect(process.atomicDepth).toBe(0)
    }
  })

  it('handles empty atomic sections without leaving the process locked', () => {
    const source = `
      shared int x = 0;

      process P1 {
        atomic {
        }

        x = x + 1;
      }

      process P2 {
        x = x + 10;
      }
    `

    const program = parseProgram(source)

    const engine = new SimulationEngine(
      createExecutionState(program),
      new RoundRobinScheduler(),
    )

    while (!engine.isFinished()) {
      const progressed = engine.step()

      if (!progressed) {
        break
      }
    }

    expect(engine.isFinished()).toBe(true)

    for (
      const process
      of engine.getState().program.processes
    ) {
      expect(process.atomicDepth).toBe(0)
    }
  })

  it('captures a shared array target index before the write', () => {
    const source = `
      shared int index = 0;
      shared int[] values = [0, 0];

      process P1 {
        values[index] = 10;
      }

      process P2 {
        index = 1;
      }
    `

    const program = parseProgram(source)

    const engine = new SimulationEngine(
      createExecutionState(program),
      new RoundRobinScheduler(),
    )

    while (!engine.isFinished()) {
      const progressed = engine.step()

      if (!progressed) {
        break
      }
    }

    expect(engine.isFinished()).toBe(true)

    expect(
      engine.getState().program.sharedMemory.values,
    ).toEqual([10, 0])
  })

  it('captures multiple shared reads used in an array target index', () => {
    const source = `
      shared int i = 0;
      shared int offset = 1;
      shared int[] values = [0, 0, 0, 0];

      process P1 {
        values[i + offset] = 50;
      }

      process P2 {
        i = 2;
        offset = 0;
      }
    `

    const program = parseProgram(source)

    const engine = new SimulationEngine(
      createExecutionState(program),
      new RoundRobinScheduler(),
    )

    while (!engine.isFinished()) {
      const progressed = engine.step()

      if (!progressed) {
        break
      }
    }

    expect(engine.isFinished()).toBe(true)

    expect(
      engine.getState().program.sharedMemory.values,
    ).toEqual([0, 50, 0, 0])

    const targetReads =
      engine
        .getState()
        .microOperationHistory
        ?.filter(
          (event) =>
            event.processId === 'P1'
            && event.type === 'SHARED_READ',
        ) ?? []

    expect(
      targetReads.map(
        (event) => event.description,
      ),
    ).toEqual([
      'i = 0',
      'offset = 1',
    ])
  })

  it('blocks a process when an AWAIT condition is false', () => {
    const process = createProcess('P1', [
      awaitInstruction(
        variable('ready'),
      ),
    ])

    const program: Program = {
      processes: [process],
      sharedMemory: {
        ready: false,
      },
    }

    const engine = new SimulationEngine(
      createExecutionState(program),
      new FirstReadyScheduler(),
    )

    engine.step()

    expect(process.state).toBe('BLOCKED')
    expect(process.programCounter).toBe(0)

    expect(process.blockingReason).toMatchObject({
      type: 'AWAIT',
      condition: {
        type: 'VARIABLE',
        name: 'ready',
      },
    })
  })

  it('completes an AWAIT without body when its condition is true', () => {
    const process = createProcess('P1', [
      awaitInstruction(
        variable('ready'),
      ),
    ])

    const program: Program = {
      processes: [process],
      sharedMemory: {
        ready: true,
      },
    }

    const engine = new SimulationEngine(
      createExecutionState(program),
      new FirstReadyScheduler(),
    )

    engine.step()

    expect(process.programCounter).toBe(1)
    expect(process.state).toBe('FINISHED')
    expect(process.blockingReason).toBeUndefined()
  })

  it('reactivates a blocked AWAIT when its condition becomes true', () => {
    const process = createProcess('P1', [
      awaitInstruction(
        variable('ready'),
      ),
    ])

    const program: Program = {
      processes: [process],
      sharedMemory: {
        ready: false,
      },
    }

    const engine = new SimulationEngine(
      createExecutionState(program),
      new FirstReadyScheduler(),
    )

    engine.step()

    expect(process.state).toBe('BLOCKED')
    expect(process.programCounter).toBe(0)

    program.sharedMemory.ready = true

    engine.step()

    expect(process.state).toBe('FINISHED')
    expect(process.programCounter).toBe(1)
    expect(process.blockingReason).toBeUndefined()
  })

  it('throws when an AWAIT condition is not boolean', () => {
    const process = createProcess('P1', [
      awaitInstruction(
        literal(123),
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

    expect(() => engine.step()).toThrow(
      'AWAIT condition must evaluate to boolean',
    )
  })


  it('reactivates every blocked process whose AWAIT condition becomes true', () => {
    const p1 = createProcess('P1', [
      awaitInstruction(
        variable('ready'),
      ),
    ])

    const p2 = createProcess('P2', [
      awaitInstruction(
        variable('ready'),
      ),
    ])

    const p3 = createProcess('P3', [
      awaitInstruction(
        variable('ready'),
      ),
    ])

    const program: Program = {
      processes: [p1, p2, p3],
      sharedMemory: {
        ready: false,
      },
    }

    const engine = new SimulationEngine(
      createExecutionState(program),
      new FirstReadyScheduler(),
    )

    engine.step()
    engine.step()
    engine.step()

    expect(p1.state).toBe('BLOCKED')
    expect(p2.state).toBe('BLOCKED')
    expect(p3.state).toBe('BLOCKED')

    program.sharedMemory.ready = true

    engine.step()

    expect(p1.state).toBe('FINISHED')
    expect(p2.state).toBe('READY')
    expect(p3.state).toBe('READY')
  })

  it('executes the enabled AWAIT body without interleaving', () => {
    const source = `
      shared bool ready = true;
      shared int x = 0;

      process P1 {
        await (ready) {
          x = x + 1;
          x = x + 1;
        }
      }

      process P2 {
        x = x + 100;
      }
    `

    const program = parseProgram(source)

    const engine = new SimulationEngine(
      createExecutionState(program),
      new RoundRobinScheduler(),
    )

    while (!engine.isFinished()) {
      const progressed = engine.step()

      if (!progressed) {
        break
      }
    }

    expect(engine.isFinished()).toBe(true)
    expect(program.sharedMemory.x).toBe(102)

    const operations =
      engine
        .getState()
        .microOperationHistory
        ?.filter(
          (event) =>
            event.type === 'SHARED_READ'
            || event.type === 'COMPUTE'
            || event.type === 'SHARED_WRITE',
        ) ?? []

    expect(
      operations.map(
        (event) => event.processId,
      ),
    ).toEqual([
      'P1',
      'P1',
      'P1',
      'P1',
      'P1',
      'P1',
      'P2',
      'P2',
      'P2',
    ])
  })

  it('releases atomic depth after an enabled AWAIT body completes', () => {
    const source = `
      shared bool ready = true;
      shared int x = 0;

      process P1 {
        await (ready) {
          x = x + 1;
        }

        x = x + 1;
      }
    `

    const program = parseProgram(source)

    const engine = new SimulationEngine(
      createExecutionState(program),
      new FirstReadyScheduler(),
    )

    while (!engine.isFinished()) {
      const progressed = engine.step()

      if (!progressed) {
        break
      }
    }

    expect(engine.isFinished()).toBe(true)
    expect(program.sharedMemory.x).toBe(2)

    expect(
      program.processes[0].atomicDepth,
    ).toBe(0)
  })

  it('reblocks a reactivated process if another process makes its AWAIT condition false first', () => {
    const source = `
      shared bool lock = true;

      process P1 {
        await (!lock) {
          lock = true;
        }
      }

      process P2 {
        await (!lock) {
          lock = true;
        }
      }
    `

    const program = parseProgram(source)

    const engine = new SimulationEngine(
      createExecutionState(program),
      new FirstReadyScheduler(),
    )

    engine.step()
    engine.step()

    const [p1, p2] = program.processes

    expect(p1.state).toBe('BLOCKED')
    expect(p2.state).toBe('BLOCKED')

    program.sharedMemory.lock = false

    engine.step()

    // FirstReady lets P1 acquire the await.
    expect(p1.state).toBe('READY')
    expect(p1.atomicDepth).toBe(1)

    // P2 was also reactivated.
    expect(p2.state).toBe('READY')

    // Finish P1's atomic acquisition.
    while (p1.atomicDepth > 0) {
      engine.step()
    }

    expect(program.sharedMemory.lock).toBe(true)

    // P1 is now finished, so P2 gets CPU.
    engine.step()

    expect(p2.state).toBe('BLOCKED')
    expect(p2.programCounter).toBe(0)

    expect(p2.blockingReason).toMatchObject({
      type: 'AWAIT',
    })
  })

  it('allows multiple processes to acquire the same lock sequentially', () => {
    const source = `
      shared bool lock = false;
      shared int counter = 0;

      process P1 {
        await (!lock) {
          lock = true;
        }

        counter = counter + 1;
        lock = false;
      }

      process P2 {
        await (!lock) {
          lock = true;
        }

        counter = counter + 1;
        lock = false;
      }
    `

    const program = parseProgram(source)

    const engine = new SimulationEngine(
      createExecutionState(program),
      new RoundRobinScheduler(),
    )

    while (!engine.isFinished()) {
      const progressed = engine.step()

      if (!progressed) {
        break
      }
    }

    expect(engine.isFinished()).toBe(true)

    expect(
      program.sharedMemory.counter,
    ).toBe(2)

    expect(
      program.sharedMemory.lock,
    ).toBe(false)

    for (const process of program.processes) {
      expect(process.state).toBe('FINISHED')
      expect(process.atomicDepth).toBe(0)
    }
  })

  it('supports atomic sections nested inside an enabled AWAIT body', () => {
    const source = `
      shared bool ready = true;
      shared int x = 0;

      process P1 {
        await (ready) {
          x = x + 1;

          atomic {
            x = x + 1;
          }

          x = x + 1;
        }
      }
    `

    const program = parseProgram(source)

    const engine = new SimulationEngine(
      createExecutionState(program),
      new FirstReadyScheduler(),
    )

    while (!engine.isFinished()) {
      const progressed = engine.step()

      if (!progressed) {
        break
      }
    }

    expect(engine.isFinished()).toBe(true)
    expect(program.sharedMemory.x).toBe(3)

    expect(
      program.processes[0].atomicDepth,
    ).toBe(0)
  })

  it('releases AWAIT atomicity when returning from its body', () => {
    const program = runSourceProgram(`
      shared bool ready = true;
      shared int result = 0;

      function calculate() {
        await (ready) {
          return 10;
        }

        return 999;
      }

      process P1 {
        result = calculate();
      }
    `)

    expect(program.sharedMemory.result).toBe(10)

    expect(
      program.processes[0].atomicDepth,
    ).toBe(0)

    expect(
      program.processes[0].state,
    ).toBe('FINISHED')
  })

  it('allows another process to run after returning from an AWAIT body', () => {
    const source = `
      shared bool ready = true;
      shared int result = 0;
      shared int other = 0;

      function calculate() {
        await (ready) {
          return 10;
        }

        return 999;
      }

      process P1 {
        result = calculate();
      }

      process P2 {
        other = other + 1;
      }
    `

    const program = parseProgram(source)

    const engine = new SimulationEngine(
      createExecutionState(program),
      new RoundRobinScheduler(),
    )

    while (!engine.isFinished()) {
      const progressed = engine.step()

      if (!progressed) {
        break
      }
    }

    expect(engine.isFinished()).toBe(true)

    expect(program.sharedMemory.result).toBe(10)
    expect(program.sharedMemory.other).toBe(1)

    for (const process of program.processes) {
      expect(process.atomicDepth).toBe(0)
    }
  })

  it('releases AWAIT atomicity when break exits an enclosing loop', () => {
    const program = runSourceProgram(`
      shared bool ready = true;
      shared int result = 0;

      process P1 {
        int i = 0;

        while (i < 10) {
          await (ready) {
            i = i + 1;
            break;
          }

          i = i + 100;
        }

        result = i;
      }
    `)

    expect(program.sharedMemory.result).toBe(1)

    expect(
      program.processes[0].atomicDepth,
    ).toBe(0)

    expect(
      program.processes[0].state,
    ).toBe('FINISHED')
  })

  it('releases and reacquires AWAIT atomicity across continue iterations', () => {
    const program = runSourceProgram(`
      shared bool ready = true;
      shared int result = 0;

      process P1 {
        int i = 0;

        while (i < 3) {
          await (ready) {
            i = i + 1;
            continue;

            i = i + 100;
          }
        }

        result = i;
      }
    `)

    expect(program.sharedMemory.result).toBe(3)

    expect(
      program.processes[0].atomicDepth,
    ).toBe(0)

    expect(
      program.processes[0].state,
    ).toBe('FINISHED')
  })

  it('releases nested atomic regions when returning from an AWAIT body', () => {
    const program = runSourceProgram(`
      shared bool ready = true;
      shared int result = 0;

      function calculate() {
        await (ready) {
          atomic {
            return 42;
          }
        }

        return 999;
      }

      process P1 {
        result = calculate();
      }
    `)

    expect(program.sharedMemory.result).toBe(42)

    expect(
      program.processes[0].atomicDepth,
    ).toBe(0)
  })

  it('records a blocked AWAIT attempt in execution history', () => {
    const source = `
      shared bool ready = false;

      process P1 {
        await (ready);
      }
    `

    const program = parseProgram(source)

    const engine = new SimulationEngine(
      createExecutionState(program),
      new FirstReadyScheduler(),
    )

    engine.step()

    expect(
      engine.getState().history.at(-1),
    ).toMatchObject({
      processId: 'P1',
      instructionType: 'AWAIT',
      awaitStatus: 'BLOCKED',
      description:
        'Await condition evaluated to false',
    })
  })

  it('records an enabled AWAIT attempt in execution history', () => {
    const source = `
      shared bool ready = true;

      process P1 {
        await (ready);
      }
    `

    const program = parseProgram(source)

    const engine = new SimulationEngine(
      createExecutionState(program),
      new FirstReadyScheduler(),
    )

    engine.step()

    expect(
      engine.getState().history.at(-1),
    ).toMatchObject({
      processId: 'P1',
      instructionType: 'AWAIT',
      awaitStatus: 'ENABLED',
      description:
        'Await condition evaluated to true',
    })
  })

  it('allows another process to enable a blocked AWAIT', () => {
    const source = `
      shared bool ready = false;
      shared int result = 0;

      process P1 {
        await (ready);
        result = 1;
      }

      process P2 {
        ready = true;
      }
    `

    const program = parseProgram(source)

    const engine = new SimulationEngine(
      createExecutionState(program),
      new RoundRobinScheduler(),
    )

    while (!engine.isFinished()) {
      const progressed = engine.step()

      if (!progressed) {
        break
      }
    }

    expect(engine.isFinished()).toBe(true)
    expect(program.sharedMemory.ready).toBe(true)
    expect(program.sharedMemory.result).toBe(1)
  })

  it('provides mutual exclusion with the coarse-grained AWAIT lock', () => {
    const source = `
      shared bool lock = false;
      shared int inside = 0;
      shared bool violation = false;

      process P1 {
        await (!lock) {
          lock = true;
        }

        inside = inside + 1;

        if (inside > 1) {
          violation = true;
        }

        inside = inside - 1;
        lock = false;
      }

      process P2 {
        await (!lock) {
          lock = true;
        }

        inside = inside + 1;

        if (inside > 1) {
          violation = true;
        }

        inside = inside - 1;
        lock = false;
      }
    `

    const program = parseProgram(source)

    const engine = new SimulationEngine(
      createExecutionState(program),
      new RoundRobinScheduler(),
    )

    while (!engine.isFinished()) {
      const progressed = engine.step()

      if (!progressed) {
        break
      }
    }

    expect(engine.isFinished()).toBe(true)

    expect(
      program.sharedMemory.violation,
    ).toBe(false)

    expect(
      program.sharedMemory.inside,
    ).toBe(0)

    expect(
      program.sharedMemory.lock,
    ).toBe(false)
  })

  it('supports the Tie-Breaker AWAIT condition used by the course', () => {
    const source = `
      shared bool in1 = false;
      shared bool in2 = false;
      shared int ultimo = 1;
      shared bool entered1 = false;

      process P1 {
        in1 = true;
        ultimo = 1;

        await (!in2 || ultimo == 2);

        entered1 = true;

        in1 = false;
      }

      process P2 {
        in2 = true;
        ultimo = 2;

        await (!in1 || ultimo == 1);

        in2 = false;
      }
    `

    const program = parseProgram(source)

    const engine = new SimulationEngine(
      createExecutionState(program),
      new RoundRobinScheduler(),
    )

    while (!engine.isFinished()) {
      const progressed = engine.step()

      if (!progressed) {
        break
      }
    }

    expect(engine.isFinished()).toBe(true)

    expect(
      program.sharedMemory.entered1,
    ).toBe(true)

    expect(
      program.sharedMemory.in1,
    ).toBe(false)

    expect(
      program.sharedMemory.in2,
    ).toBe(false)
  })

  it('supports the Ticket AWAIT condition used by the course', () => {
    const source = `
      shared int[] turno = [0, 1];
      shared int proximo = 0;
      shared bool p1Entered = false;
      shared bool p2Entered = false;

      process P1 {
        int i = 0;

        await (turno[i] == proximo);

        p1Entered = true;
        proximo = proximo + 1;
      }

      process P2 {
        int i = 1;

        await (turno[i] == proximo);

        p2Entered = true;
      }
    `

    const program = parseProgram(source)

    const engine = new SimulationEngine(
      createExecutionState(program),
      new RoundRobinScheduler(),
    )

    while (!engine.isFinished()) {
      const progressed = engine.step()

      if (!progressed) {
        break
      }
    }

    expect(engine.isFinished()).toBe(true)

    expect(
      program.sharedMemory.p1Entered,
    ).toBe(true)

    expect(
      program.sharedMemory.p2Entered,
    ).toBe(true)

    expect(
      program.sharedMemory.proximo,
    ).toBe(1)
  })

  it('P decrements an available semaphore', () => {
    const program = parseProgram(`
      sem mutex = 1;

      process P1 {
        P(mutex);
      }
    `)

    const engine = new SimulationEngine(
      createExecutionState(program),
      new FirstReadyScheduler(),
    )

    engine.step()

    expect(
      engine.getState().program.semaphores?.mutex.value,
    ).toBe(0)

    expect(
      engine.getState().program.processes[0].state,
    ).toBe('FINISHED')
  })

  it('P blocks when semaphore value is zero', () => {
    const program = parseProgram(`
      sem gate = 0;

      process P1 {
        P(gate);
      }
    `)

    const engine = new SimulationEngine(
      createExecutionState(program),
      new FirstReadyScheduler(),
    )

    engine.step()

    const process =
      engine.getState().program.processes[0]

    expect(process.state).toBe('BLOCKED')

    expect(process.programCounter).toBe(0)

    expect(process.blockingReason).toEqual({
      type: 'SEMAPHORE_P',
      semaphoreName: 'gate',
    })

    expect(
      engine.getState().program.semaphores?.gate.value,
    ).toBe(0)
  })

  it('V increments a semaphore', () => {
    const program = parseProgram(`
      sem signal = 0;

      process P1 {
        V(signal);
      }
    `)

    const engine = new SimulationEngine(
      createExecutionState(program),
      new FirstReadyScheduler(),
    )

    engine.step()

    expect(
      engine.getState().program.semaphores?.signal.value,
    ).toBe(1)
  })

  it('V enables a process blocked on P', () => {
    const program = parseProgram(`
      sem signal = 0;

      process P1 {
        P(signal);
      }

      process P2 {
        V(signal);
      }
    `)

    const engine = new SimulationEngine(
      createExecutionState(program),
      new FirstReadyScheduler(),
    )

    engine.step()

    expect(
      engine.getState().program.processes[0].state,
    ).toBe('BLOCKED')

    engine.step()

    expect(
      engine.getState().program.semaphores?.signal.value,
    ).toBe(1)

    engine.step()

    expect(
      engine.getState().program.semaphores?.signal.value,
    ).toBe(0)

    expect(
      engine.getState().program.processes[0].state,
    ).toBe('FINISHED')
  })

  it('exposes semaphore values and blocked waiters in the snapshot', () => {
    const program = parseProgram(`
      sem gate = 0;
      sem available = 2;

      process P1 {
        P(gate);
      }

      process P2 {
        P(gate);
      }
    `)

    const engine = new SimulationEngine(
      createExecutionState(program),
      new FirstReadyScheduler(),
    )

    engine.step()
    engine.step()

    expect(engine.getSnapshot().semaphores).toEqual([
      {
        name: 'gate',
        value: 0,
        waitingProcessIds: ['P1', 'P2'],
      },
      {
        name: 'available',
        value: 2,
        waitingProcessIds: [],
      },
    ])
  })

  it('clears execution focus when the simulation resets', () => {
    const engine = new SimulationEngine(
      createExecutionState(parseProgram(`
        process P1 {
          int value = 1;
        }
      `)),
      new FirstReadyScheduler(),
    )

    expect(engine.getSnapshot().executionFocus)
      .toBeUndefined()

    engine.step()
    expect(engine.getSnapshot().executionFocus?.processId)
      .toBe('P1')

    engine.reset()
    expect(engine.getSnapshot().executionFocus)
      .toBeUndefined()
  })

  it('returns semaphore copies in the visualization snapshot', () => {
    const program = parseProgram(`
      sem gate = 1;

      process P1 {
        P(gate);
      }
    `)

    const engine = new SimulationEngine(
      createExecutionState(program),
      new FirstReadyScheduler(),
    )

    const snapshot = engine.getSnapshot()

    engine.step()

    expect(
      engine.getState().program.semaphores?.gate.value,
    ).toBe(0)

    expect(snapshot.semaphores[0]).toEqual({
      name: 'gate',
      value: 1,
      waitingProcessIds: [],
    })
  })

  it('records structured semaphore transitions in execution history', () => {
    const program = parseProgram(`
      sem signal = 0;

      process P1 {
        P(signal);
      }

      process P2 {
        V(signal);
      }
    `)

    const engine = new SimulationEngine(
      createExecutionState(program),
      new FirstReadyScheduler(),
    )

    engine.step()
    engine.step()
    engine.step()

    expect(
      engine.getState().history.map(
        (event) => event.semaphoreEvent,
      ),
    ).toEqual([
      {
        operation: 'P',
        semaphoreName: 'signal',
        status: 'BLOCKED',
        valueBefore: 0,
        valueAfter: 0,
      },
      {
        operation: 'V',
        semaphoreName: 'signal',
        status: 'SUCCEEDED',
        valueBefore: 0,
        valueAfter: 1,
      },
      {
        operation: 'P',
        semaphoreName: 'signal',
        status: 'SUCCEEDED',
        valueBefore: 1,
        valueAfter: 0,
      },
    ])
  })
})
