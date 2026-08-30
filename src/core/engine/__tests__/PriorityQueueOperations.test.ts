import { describe, expect, it } from 'vitest'
import { parseProgram } from '../../language/parseProgram'
import { isPriorityQueueValue } from '../../memory/RuntimeValue'
import { FirstReadyScheduler } from '../../scheduler/FirstReadyScheduler'
import { createExecutionState } from '../createExecutionState'
import { SimulationEngine } from '../SimulationEngine'

function createEngine(source: string): SimulationEngine {
  return new SimulationEngine(
    createExecutionState(parseProgram(source)),
    new FirstReadyScheduler(),
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
    `Priority queue program did not finish after ${maximumSteps} steps`,
  )
}

describe('stable priority queue operations', () => {
  it('serves higher numbers first and preserves FIFO order on ties', () => {
    const engine = createEngine(`
      shared priority_queue<string> jobs = priority_queue[];

      process Worker {
        jobs.enqueue("low", 1);
        jobs.enqueue("first-high", 3);
        jobs.enqueue("second-high", 3);
        jobs.enqueue("medium", 2);
        string observed = jobs.front();
        string first = jobs.dequeue();
        string second = jobs.dequeue();
        string third = jobs.dequeue();
        string fourth = jobs.dequeue();
        int finalSize = jobs.size();
        bool empty = jobs.isEmpty();
      }
    `)

    runToCompletion(engine)

    const process = engine.getState().program.processes[0]
    const queue = engine.getState().program.sharedMemory.jobs

    expect(process.localMemory).toMatchObject({
      observed: 'first-high',
      first: 'first-high',
      second: 'second-high',
      third: 'medium',
      fourth: 'low',
      finalSize: 0,
      empty: true,
    })
    expect(isPriorityQueueValue(queue)).toBe(true)

    if (!isPriorityQueueValue(queue)) {
      throw new Error('Expected jobs to be a priority queue')
    }

    expect(queue.items).toEqual([])

    const firstEvent = engine.getState().history
      .find((event) => event.dataStructureEvent)

    expect(firstEvent?.dataStructureEvent).toMatchObject({
      operation: 'ENQUEUE',
      structureKind: 'PRIORITY_QUEUE',
      priority: 1,
      value: 'low',
      sizeBefore: 0,
      sizeAfter: 1,
    })
  })

  it('sorts initialized entries while preserving source order on ties', () => {
    const engine = createEngine(`
      shared priority_queue<int> jobs =
        priority_queue[(10, 2), (20, 5), (30, 5), (40, -1)];

      process Worker {
        int first = jobs.dequeue();
        int second = jobs.dequeue();
        int third = jobs.dequeue();
        int fourth = jobs.dequeue();
      }
    `)

    runToCompletion(engine)

    expect(
      engine.getState().program.processes[0].localMemory,
    ).toMatchObject({
      first: 20,
      second: 30,
      third: 10,
      fourth: 40,
    })
  })

  it('requires an integer priority when enqueuing', () => {
    const missing = createEngine(`
      process Worker {
        priority_queue<int> jobs = priority_queue[];
        jobs.enqueue(1);
      }
    `)
    missing.step()

    expect(() => missing.step()).toThrow(
      'priority_queue.enqueue() requires a value and an integer priority',
    )

    const wrongType = createEngine(`
      process Worker {
        priority_queue<int> jobs = priority_queue[];
        jobs.enqueue(1, "high");
      }
    `)
    wrongType.step()

    expect(() => wrongType.step()).toThrow(
      'Priority must be an integer',
    )
  })

  it('rejects priority arguments on FIFO queues', () => {
    const engine = createEngine(`
      process Worker {
        queue<int> jobs = queue[];
        jobs.enqueue(1, 3);
      }
    `)
    engine.step()

    expect(() => engine.step()).toThrow(
      'queue.enqueue() accepts only one value; priorities require priority_queue',
    )
  })

  it('returns detached priority queue values in snapshots', () => {
    const engine = createEngine(`
      shared priority_queue<int> jobs = priority_queue[(1, 2)];
      process Worker { }
    `)
    const snapshotQueue = engine.getSnapshot().sharedMemory.jobs
    const stateQueue = engine.getState().program.sharedMemory.jobs

    if (
      !isPriorityQueueValue(snapshotQueue)
      || !isPriorityQueueValue(stateQueue)
    ) {
      throw new Error('Expected jobs to be a priority queue')
    }

    snapshotQueue.items.push({ value: 2, priority: 4 })

    expect(snapshotQueue.items).toHaveLength(2)
    expect(stateQueue.items).toEqual([
      { value: 1, priority: 2 },
    ])
  })
})
