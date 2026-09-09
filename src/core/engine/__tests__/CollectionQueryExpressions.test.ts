import { describe, expect, it } from 'vitest'
import { parseProgram } from '../../language/parseProgram'
import { isQueueValue } from '../../memory/RuntimeValue'
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
  maximumSteps = 200,
): void {
  for (let step = 0; step < maximumSteps; step++) {
    if (engine.isFinished()) {
      return
    }

    engine.step()
  }

  throw new Error(
    `Collection-query program did not finish after ${maximumSteps} steps`,
  )
}

describe('collection query expressions', () => {
  it('uses a shared queue isEmpty guard and size in a compound assignment', () => {
    const engine = createEngine(`
      shared queue<int> resources = queue[10, 20, 30];

      process Worker {
        int accumulatedSizes = 0;

        while (!resources.isEmpty()) {
          accumulatedSizes = accumulatedSizes + resources.size();
          int current = resources.dequeue();
        }
      }
    `)

    runToCompletion(engine)

    const state = engine.getState()
    const process = state.program.processes[0]
    const resources = state.program.sharedMemory.resources

    expect(process.localMemory.accumulatedSizes).toBe(6)
    expect(isQueueValue(resources)).toBe(true)

    if (!isQueueValue(resources)) {
      throw new Error('Expected resources to be a queue')
    }

    expect(resources.items).toEqual([])
    expect(state.history.filter(
      (event) => event.loopConditionEvent,
    ).at(-1)?.loopConditionEvent).toMatchObject({
      conditionResult: false,
      sharedVariableNames: ['resources'],
    })
  })

  it('supports size and isEmpty on local and shared arrays', () => {
    const engine = createEngine(`
      shared int[] values = [1, 2, 3];

      process Worker {
        int[] none = [];
        int count = values.size();
        bool sharedEmpty = values.isEmpty();
        bool localEmpty = none.isEmpty();
        int adjusted = values.size() + 7;

        if (!values.isEmpty() && values.size() == 3) {
          print(values.size());
        }
      }
    `)

    runToCompletion(engine)

    const state = engine.getState()
    const process = state.program.processes[0]

    expect(process.localMemory).toMatchObject({
      count: 3,
      sharedEmpty: false,
      localEmpty: true,
      adjusted: 10,
    })
    expect(state.history.filter(
      (event) => event.dataStructureEvent,
    )).toHaveLength(0)
    expect(state.history.find(
      (event) => event.simulatedOperationEvent,
    )?.simulatedOperationEvent?.arguments).toEqual([3])
  })

  it('supports compound queries for stacks and priority queues', () => {
    const engine = createEngine(`
      process Worker {
        stack<int> values = stack[1, 2];
        priority_queue<string> jobs = priority_queue[("urgent", 3)];
        bool ready = values.size() == 2 && !jobs.isEmpty();
      }
    `)

    runToCompletion(engine)

    expect(
      engine.getState().program.processes[0].localMemory.ready,
    ).toBe(true)
  })

  it('reevaluates an await query after another process enqueues', () => {
    const engine = createEngine(`
      shared queue<int> mailbox = queue[];

      process Consumer {
        await (!mailbox.isEmpty());
        int received = mailbox.dequeue();
      }

      process Producer {
        mailbox.enqueue(42);
      }
    `, new RoundRobinScheduler())

    runToCompletion(engine)

    expect(
      engine.getState().program.processes[0].localMemory.received,
    ).toBe(42)
  })

  it('restores direct array queries with Step Back', () => {
    const engine = createEngine(`
      process Worker {
        int[] values = [1, 2];
        int count = values.size();
      }
    `)

    engine.step()
    engine.step()
    expect(
      engine.getState().program.processes[0].localMemory.count,
    ).toBe(2)

    expect(engine.stepBack()).toBe(true)
    expect(
      engine.getState().program.processes[0].localMemory.count,
    ).toBeUndefined()

    engine.step()
    expect(
      engine.getState().program.processes[0].localMemory.count,
    ).toBe(2)
  })

  it('reports a clear error when the receiver is not a collection', () => {
    const engine = createEngine(`
      process Worker {
        int value = 3;

        if (value.isEmpty()) {
          print("unreachable");
        }
      }
    `)

    engine.step()

    expect(() => engine.step()).toThrow(
      'isEmpty() requires an array, queue, priority_queue or stack',
    )
  })
})
