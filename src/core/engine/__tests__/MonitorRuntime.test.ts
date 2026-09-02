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

  it('parses in/out parameters and arguments from the procedure signature', () => {
    const program = parseProgram(`
      monitor Counter {
        int value = 0;
        procedure add(in int amount, out int result) {
          value = value + amount;
          result = value;
        }
      }
      process P1 {
        int result = 0;
        Counter.add(2 + 3, result);
      }
    `)

    expect(program.monitors?.Counter.procedures.add.parameters)
      .toMatchObject([
        { name: 'amount', mode: 'IN' },
        { name: 'result', mode: 'OUT' },
      ])
    expect(program.processes[0].instructions[1]).toMatchObject({
      arguments: [
        { mode: 'IN', expression: { type: 'BINARY' } },
        { mode: 'OUT', target: { type: 'VARIABLE', name: 'result' } },
      ],
    })
  })

  it('copies in values and writes every out target before releasing the monitor', () => {
    const engine = createEngine(`
      record Result { int value; bool ok; }

      monitor Calculator {
        int total = 1;

        procedure distribute(
          in int amount,
          out int scalar,
          out int item,
          out int field,
          out int nested
        ) {
          total = total + amount;
          scalar = total;
          item = total + 1;
          field = total + 2;
          nested = total + 3;
        }
      }

      process P1 {
        int result = 0;
        int[] values = [0, 0];
        Result summary = Result { value: 0, ok: false };
        Result[] summaries = [Result { value: 0, ok: false }];
        Calculator.distribute(
          4,
          result,
          values[1],
          summary.value,
          summaries[0].value
        );
      }
    `)

    runToCompletion(engine)

    expect(engine.getState().program.processes[0].localMemory)
      .toEqual({
        result: 5,
        values: [0, 6],
        summary: {
          kind: 'RECORD',
          recordType: 'Result',
          fields: { value: 7, ok: false },
        },
        summaries: [{
          kind: 'RECORD',
          recordType: 'Result',
          fields: { value: 8, ok: false },
        }],
      })
    expect(engine.getState().monitorStates?.Calculator).toMatchObject({
      ownerProcessId: undefined,
      memory: { total: 5 },
    })
  })

  it('captures in values and concrete out indexes before waiting for entry', () => {
    const engine = createEngine(`
      monitor Gate {
        int total = 0;

        procedure hold() {
          total = total + 1;
          total = total + 1;
          total = total + 1;
          total = total + 1;
        }

        procedure add(in int amount, out int result) {
          total = total + amount;
          result = total;
        }
      }

      process P1 { Gate.hold(); }
      process P2 {
        int amount = 5;
        int index = 0;
        int[] results = [0, 0];
        Gate.add(amount, results[index]);
      }
    `, true)

    const second = engine.getState().program.processes[1]

    for (let step = 0; step < 20 && !second.pendingMonitorEntry; step++) {
      engine.step()
    }

    expect(second).toMatchObject({
      state: 'BLOCKED',
      pendingMonitorEntry: {
        monitorName: 'Gate',
        procedureName: 'add',
        parameterMemory: { amount: 5 },
      },
    })

    second.localMemory.amount = 99
    second.localMemory.index = 1
    runToCompletion(engine)

    expect(second.localMemory.results).toEqual([9, 0])
  })

  it('rejects reading or omitting an out value', () => {
    const unreadable = createEngine(`
      monitor Counter {
        procedure invalid(out int result) {
          result = result + 1;
        }
      }
      process P1 {
        int result = 0;
        Counter.invalid(result);
      }
    `)

    unreadable.step()
    unreadable.step()
    expect(() => unreadable.step()).toThrow(
      'OUT parameter "result" cannot be read before assignment',
    )

    const missing = createEngine(`
      monitor Counter {
        procedure invalid(out int result) { }
      }
      process P1 {
        int result = 0;
        Counter.invalid(result);
      }
    `)

    missing.step()
    expect(() => missing.step()).toThrow(
      'OUT parameter "result" must be assigned before procedure returns',
    )
  })

  it('validates parameter types and keeps out destinations local', () => {
    const wrongInput = createEngine(`
      monitor Counter {
        procedure add(in int amount) { }
      }
      process P1 { Counter.add(true); }
    `)

    expect(() => wrongInput.step()).toThrow(
      'IN parameter "amount" requires int but received bool',
    )

    const sharedOutput = createEngine(`
      shared int result = 0;
      monitor Counter {
        procedure read(out int value) { value = 1; }
      }
      process P1 { Counter.read(result); }
    `)

    expect(() => sharedOutput.step()).toThrow(
      'OUT parameter "value" must target local memory',
    )
  })

  it('writes out values back into function and enclosing monitor frames', () => {
    const engine = createEngine(`
      monitor Inner {
        procedure produce(in int input, out int output) {
          output = input * 2;
        }
      }

      monitor Outer {
        procedure calculate(in int input, out int output) {
          int temporary = 0;
          Inner.produce(input, temporary);
          output = temporary + 1;
        }
      }

      function calculateWithMonitor(int input) {
        int output = 0;
        Outer.calculate(input, output);
        return output;
      }

      process P1 {
        int result = calculateWithMonitor(5);
      }
    `)

    runToCompletion(engine)

    expect(engine.getState().program.processes[0].localMemory.result)
      .toBe(11)
    expect(engine.getState().monitorStates?.Inner.ownerProcessId)
      .toBeUndefined()
    expect(engine.getState().monitorStates?.Outer.ownerProcessId)
      .toBeUndefined()
  })

  it('copies record arrays, queues, priority queues and stacks through parameters', () => {
    const engine = createEngine(`
      record Item { int id; }

      monitor Copier {
        procedure copy(
          in Item[] records,
          out Item[] recordsResult,
          in queue<int> queueValue,
          out queue<int> queueResult,
          in priority_queue<int> priorityValue,
          out priority_queue<int> priorityResult,
          in stack<int> stackValue,
          out stack<int> stackResult
        ) {
          recordsResult = records;
          queueResult = queueValue;
          priorityResult = priorityValue;
          stackResult = stackValue;
        }
      }

      process P1 {
        Item[] records = [Item { id: 7 }];
        Item[] recordsCopy = [];
        queue<int> fifo = queue[1];
        queue<int> fifoCopy = queue[];
        priority_queue<int> priorities = priority_queue[(3, 2)];
        priority_queue<int> prioritiesCopy = priority_queue[];
        stack<int> stackValue = stack[9];
        stack<int> stackCopy = stack[];
        Copier.copy(
          records,
          recordsCopy,
          fifo,
          fifoCopy,
          priorities,
          prioritiesCopy,
          stackValue,
          stackCopy
        );
        fifo.enqueue(2);
      }
    `)

    runToCompletion(engine)

    const memory = engine.getState().program.processes[0].localMemory

    expect(memory.recordsCopy).toEqual(memory.records)
    expect(memory.fifo).toMatchObject({ items: [1, 2] })
    expect(memory.fifoCopy).toMatchObject({ items: [1] })
    expect(memory.prioritiesCopy).toEqual(memory.priorities)
    expect(memory.stackCopy).toEqual(memory.stackValue)
  })

  it('rejects invalid signatures, arity and unknown procedures precisely', () => {
    expect(() => parseProgram(`
      monitor Counter {
        procedure add(int amount) { }
      }
      process P1 { }
    `)).toThrow(
      'Expected "in" or "out" before monitor parameter type',
    )

    expect(() => parseProgram(`
      monitor Counter {
        procedure add(in int amount) { }
      }
      process P1 { Counter.add(); }
    `)).toThrow(
      'Missing argument for in parameter "amount"',
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
