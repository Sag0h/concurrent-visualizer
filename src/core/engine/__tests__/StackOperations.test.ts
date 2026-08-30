import { describe, expect, it } from 'vitest'
import { parseProgram } from '../../language/parseProgram'
import { isStackValue } from '../../memory/RuntimeValue'
import { FirstReadyScheduler } from '../../scheduler/FirstReadyScheduler'
import { RoundRobinScheduler } from '../../scheduler/RoundRobinScheduler'
import type { Scheduler } from '../../scheduler/Scheduler'
import { createExecutionState } from '../createExecutionState'
import { SimulationEngine } from '../SimulationEngine'

function createEngine(
  source: string,
  scheduler: Scheduler = new FirstReadyScheduler(),
): SimulationEngine {
  return new SimulationEngine(
    createExecutionState(parseProgram(source)),
    scheduler,
  )
}

function runToCompletion(
  engine: SimulationEngine,
  maximumSteps = 100,
): void {
  for (let step = 0; step < maximumSteps; step++) {
    if (engine.isFinished()) {
      return
    }

    engine.step()
  }

  throw new Error(
    `Stack program did not finish after ${maximumSteps} steps`,
  )
}

describe('stack operations', () => {
  it('preserves LIFO order across every supported operation', () => {
    const engine = createEngine(`
      shared stack<int> values = stack[10, 20];

      process Worker {
        values.push(30);
        int observedTop = values.top();
        int first = values.pop();
        int second = values.pop();
        int third = values.pop();
        int finalSize = values.size();
        bool empty = values.isEmpty();
      }
    `)

    runToCompletion(engine)

    const process = engine.getState().program.processes[0]
    const stack = engine.getState().program.sharedMemory.values

    expect(process.localMemory).toMatchObject({
      observedTop: 30,
      first: 30,
      second: 20,
      third: 10,
      finalSize: 0,
      empty: true,
    })

    if (!isStackValue(stack)) {
      throw new Error('Expected values to be a stack')
    }

    expect(stack.items).toEqual([])

    const events = engine.getState().history
      .filter((event) => event.dataStructureEvent)

    expect(events).toHaveLength(7)
    expect(events[0].dataStructureEvent).toMatchObject({
      operation: 'PUSH',
      structureName: 'values',
      structureKind: 'STACK',
      scope: 'SHARED',
      sizeBefore: 2,
      sizeAfter: 3,
      value: 30,
    })
    expect(events[1].dataStructureEvent).toMatchObject({
      operation: 'TOP',
      sizeBefore: 3,
      sizeAfter: 3,
      value: 30,
    })
  })

  it('keeps local stacks isolated between processes', () => {
    const engine = createEngine(`
      process P1 {
        stack<int> local = stack[];
        local.push(1);
        int value = local.pop();
      }

      process P2 {
        stack<int> local = stack[];
        local.push(2);
        int value = local.pop();
      }
    `, new RoundRobinScheduler())

    runToCompletion(engine)

    const [p1, p2] = engine.getState().program.processes

    expect(p1.localMemory.value).toBe(1)
    expect(p2.localMemory.value).toBe(2)
    expect(p1.localMemory.local).not.toBe(p2.localMemory.local)
  })

  it('executes shared pop operations atomically', () => {
    const engine = createEngine(`
      shared stack<int> values = stack[1, 2];

      process P1 {
        int value = values.pop();
      }

      process P2 {
        int value = values.pop();
      }
    `, new RoundRobinScheduler())

    runToCompletion(engine)

    const [p1, p2] = engine.getState().program.processes
    const stack = engine.getState().program.sharedMemory.values

    expect(p1.localMemory.value).toBe(2)
    expect(p2.localMemory.value).toBe(1)

    if (!isStackValue(stack)) {
      throw new Error('Expected values to be a stack')
    }

    expect(stack.items).toEqual([])
  })

  it('rejects pop and top on an empty stack', () => {
    const popEngine = createEngine(`
      process Worker {
        stack<int> values = stack[];
        int value = values.pop();
      }
    `)
    popEngine.step()

    expect(() => popEngine.step()).toThrow(
      'Stack "values" is empty; pop() cannot continue',
    )

    const topEngine = createEngine(`
      process Worker {
        stack<int> values = stack[];
        int value = values.top();
      }
    `)
    topEngine.step()

    expect(() => topEngine.step()).toThrow(
      'Stack "values" is empty; top() cannot continue',
    )
  })

  it('rejects incompatible values and queue-only methods', () => {
    const wrongType = createEngine(`
      process Worker {
        stack<int> values = stack[];
        values.push("wrong");
      }
    `)
    wrongType.step()

    expect(() => wrongType.step()).toThrow(
      'Stack<int> cannot store string',
    )

    const wrongMethod = createEngine(`
      process Worker {
        stack<int> values = stack[1];
        int value = values.dequeue();
      }
    `)
    wrongMethod.step()

    expect(() => wrongMethod.step()).toThrow(
      'dequeue() requires a queue',
    )
  })

  it('keeps shared reads outside atomic push arguments', () => {
    const engine = createEngine(`
      shared int next = 2;
      shared stack<int> values = stack[1];

      process Producer {
        values.push(next);
      }
    `)

    expect(() => engine.step()).toThrow(
      'Shared-memory reads inside push() are not supported yet; copy the value to local memory first',
    )
  })

  it('requires stack results to target local memory', () => {
    const engine = createEngine(`
      shared int result = 0;
      shared stack<int> values = stack[1];

      process Consumer {
        result = values.pop();
      }
    `)

    expect(() => engine.step()).toThrow(
      'Data structure operation results must be assigned to local memory',
    )

    const stack = engine.getState().program.sharedMemory.values

    if (!isStackValue(stack)) {
      throw new Error('Expected values to be a stack')
    }

    expect(stack.items).toEqual([1])
  })

  it('returns detached stack values in snapshots', () => {
    const engine = createEngine(`
      shared stack<int> values = stack[1];
      process Worker { }
    `)
    const snapshotStack = engine.getSnapshot().sharedMemory.values
    const stateStack = engine.getState().program.sharedMemory.values

    if (
      !isStackValue(snapshotStack)
      || !isStackValue(stateStack)
    ) {
      throw new Error('Expected values to be a stack')
    }

    snapshotStack.items.push(2)

    expect(snapshotStack.items).toEqual([1, 2])
    expect(stateStack.items).toEqual([1])
  })
})
