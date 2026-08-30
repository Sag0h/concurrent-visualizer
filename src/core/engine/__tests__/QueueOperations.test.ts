import { describe, expect, it } from 'vitest'
import { isQueueValue } from '../../memory/RuntimeValue'
import { parseProgram } from '../../language/parseProgram'
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
    `Queue program did not finish after ${maximumSteps} steps`,
  )
}

describe('FIFO queue operations', () => {
  it('preserves FIFO order across every supported operation', () => {
    const engine = createEngine(`
      shared queue<int> jobs = queue[10, 20];

      process Worker {
        jobs.enqueue(30);
        int observedFront = jobs.front();
        int first = jobs.dequeue();
        int second = jobs.dequeue();
        int third = jobs.dequeue();
        int finalSize = jobs.size();
        bool empty = jobs.isEmpty();
      }
    `)

    runToCompletion(engine)

    const process =
      engine.getState().program.processes[0]
    const queue =
      engine.getState().program.sharedMemory.jobs

    expect(process.localMemory).toMatchObject({
      observedFront: 10,
      first: 10,
      second: 20,
      third: 30,
      finalSize: 0,
      empty: true,
    })
    expect(isQueueValue(queue)).toBe(true)

    if (!isQueueValue(queue)) {
      throw new Error('Expected jobs to be a queue')
    }

    expect(queue.items).toEqual([])

    const events = engine.getState().history
      .filter((event) => event.queueEvent)

    expect(events).toHaveLength(7)
    expect(events[0].queueEvent).toMatchObject({
      operation: 'ENQUEUE',
      queueName: 'jobs',
      scope: 'SHARED',
      sizeBefore: 2,
      sizeAfter: 3,
      value: 30,
    })
    expect(events.at(-2)?.queueEvent).toMatchObject({
      operation: 'SIZE',
      value: 0,
      sizeBefore: 0,
      sizeAfter: 0,
    })
    expect(events.at(-1)?.queueEvent).toMatchObject({
      operation: 'IS_EMPTY',
      value: true,
    })
  })

  it('keeps local queues isolated between processes', () => {
    const engine = createEngine(`
      process P1 {
        queue<int> local = queue[];
        local.enqueue(1);
        int value = local.dequeue();
      }

      process P2 {
        queue<int> local = queue[];
        local.enqueue(2);
        int value = local.dequeue();
      }
    `, new RoundRobinScheduler())

    runToCompletion(engine)

    const [p1, p2] =
      engine.getState().program.processes

    expect(p1.localMemory.value).toBe(1)
    expect(p2.localMemory.value).toBe(2)
    expect(p1.localMemory.local).not.toBe(
      p2.localMemory.local,
    )
  })

  it('executes shared dequeue operations atomically', () => {
    const engine = createEngine(`
      shared queue<int> jobs = queue[1, 2];

      process P1 {
        int value = jobs.dequeue();
      }

      process P2 {
        int value = jobs.dequeue();
      }
    `, new RoundRobinScheduler())

    runToCompletion(engine)

    const [p1, p2] =
      engine.getState().program.processes
    const queue =
      engine.getState().program.sharedMemory.jobs

    expect(p1.localMemory.value).toBe(1)
    expect(p2.localMemory.value).toBe(2)

    if (!isQueueValue(queue)) {
      throw new Error('Expected jobs to be a queue')
    }

    expect(queue.items).toEqual([])
  })

  it('rejects dequeue and front on an empty queue', () => {
    const dequeueEngine = createEngine(`
      process Worker {
        queue<int> jobs = queue[];
        int value = jobs.dequeue();
      }
    `)

    dequeueEngine.step()

    expect(() => dequeueEngine.step()).toThrow(
      'Queue "jobs" is empty; dequeue() cannot continue',
    )

    const frontEngine = createEngine(`
      process Worker {
        queue<int> jobs = queue[];
        int value = jobs.front();
      }
    `)

    frontEngine.step()

    expect(() => frontEngine.step()).toThrow(
      'Queue "jobs" is empty; front() cannot continue',
    )
  })

  it('rejects values incompatible with the queue element type', () => {
    const engine = createEngine(`
      process Worker {
        queue<int> jobs = queue[];
        jobs.enqueue("wrong");
      }
    `)

    engine.step()

    expect(() => engine.step()).toThrow(
      'Queue<int> cannot store string',
    )
  })

  it('keeps shared reads outside atomic enqueue arguments', () => {
    const engine = createEngine(`
      shared int next = 2;
      shared queue<int> jobs = queue[1];

      process Producer {
        jobs.enqueue(next);
      }
    `)

    expect(() => engine.step()).toThrow(
      'Shared-memory reads inside enqueue() are not supported yet; copy the value to local memory first',
    )
  })

  it('requires queue results to target local memory', () => {
    const engine = createEngine(`
      shared int result = 0;
      shared queue<int> jobs = queue[1];

      process Consumer {
        result = jobs.dequeue();
      }
    `)

    expect(() => engine.step()).toThrow(
      'Queue operation results must be assigned to local memory',
    )

    const queue =
      engine.getState().program.sharedMemory.jobs

    if (!isQueueValue(queue)) {
      throw new Error('Expected jobs to be a queue')
    }

    expect(queue.items).toEqual([1])
  })

  it('returns detached queue values in snapshots', () => {
    const engine = createEngine(`
      shared queue<int> jobs = queue[1];
      process Worker { }
    `)
    const snapshotQueue =
      engine.getSnapshot().sharedMemory.jobs
    const stateQueue =
      engine.getState().program.sharedMemory.jobs

    if (
      !isQueueValue(snapshotQueue)
      || !isQueueValue(stateQueue)
    ) {
      throw new Error('Expected jobs to be a queue')
    }

    snapshotQueue.items.push(2)

    expect(snapshotQueue.items).toEqual([1, 2])
    expect(stateQueue.items).toEqual([1])
  })
})
