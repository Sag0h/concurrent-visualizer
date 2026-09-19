import { describe, expect, it } from 'vitest'
import { parseProgram } from '../../language/parseProgram'
import { FirstReadyScheduler } from '../../scheduler/FirstReadyScheduler'
import { createExecutionState } from '../createExecutionState'
import { SimulationEngine } from '../SimulationEngine'

function createEngine(source: string): SimulationEngine {
  return new SimulationEngine(
    createExecutionState(parseProgram(source)),
    new FirstReadyScheduler(),
  )
}

function run(engine: SimulationEngine, maximumSteps = 100): void {
  for (let step = 0; step < maximumSteps; step++) {
    if (engine.isFinished()) {
      return
    }

    if (!engine.step()) {
      throw new Error('Engine stopped before finishing')
    }
  }

  throw new Error(`Engine did not finish after ${maximumSteps} steps`)
}

describe('PMA channel send runtime', () => {
  it('creates an independent FIFO mailbox for every concrete channel', () => {
    const state = createExecutionState(parseProgram(`
      chan jobs(int);
      chan replies[3](string);
    `))

    expect(state.channelStates).toEqual({
      jobs: { messages: [] },
      'replies[0]': { messages: [] },
      'replies[1]': { messages: [] },
      'replies[2]': { messages: [] },
    })
  })

  it('enqueues tuple payloads in FIFO order and emits structured events', () => {
    const engine = createEngine(`
      chan jobs(int, string);

      process Producer {
        send jobs(1, "first");
        send jobs(2, "second");
      }
    `)

    run(engine)

    expect(engine.getState().channelStates?.jobs.messages).toEqual([
      { values: [1, 'first'] },
      { values: [2, 'second'] },
    ])
    expect(engine.getState().history.map(
      (event) => event.messagePassingEvent,
    )).toEqual([
      {
        operation: 'SEND',
        channelName: 'jobs',
        status: 'SUCCEEDED',
        messageCountBefore: 0,
        messageCountAfter: 1,
        values: [1, 'first'],
      },
      {
        operation: 'SEND',
        channelName: 'jobs',
        status: 'SUCCEEDED',
        messageCountBefore: 1,
        messageCountAfter: 2,
        values: [2, 'second'],
      },
    ])
  })

  it('resolves channel array indexes when the send executes', () => {
    const engine = createEngine(`
      chan replies[2](string);

      process Producer {
        int target = 1;
        send replies[target]("ready");
      }
    `)

    run(engine)

    expect(engine.getState().channelStates?.['replies[0]'].messages)
      .toEqual([])
    expect(engine.getState().channelStates?.['replies[1]'].messages)
      .toEqual([{ values: ['ready'] }])
  })

  it('supports a suspended function call in the channel index', () => {
    const engine = createEngine(`
      function target() { return 1; }
      chan replies[2](string);

      process Producer {
        send replies[target()]("ready");
      }
    `)

    run(engine)

    expect(engine.getState().channelStates['replies[0]'].messages)
      .toEqual([])
    expect(engine.getState().channelStates['replies[1]'].messages)
      .toEqual([{ values: ['ready'] }])
  })

  it('copies record payloads when they are sent', () => {
    const engine = createEngine(`
      record Job { int id; }
      chan jobs(Job);

      process Producer {
        Job job = Job { id: 1 };
        send jobs(job);
        job.id = 2;
      }
    `)

    run(engine)

    expect(engine.getState().channelStates?.jobs.messages).toEqual([{
      values: [{
        kind: 'RECORD',
        recordType: 'Job',
        fields: { id: 1 },
      }],
    }])
  })

  it('validates function results against the channel payload at runtime', () => {
    const engine = createEngine(`
      function wrong() { return true; }
      chan jobs(int);

      process Producer {
        send jobs(wrong());
      }
    `)

    expect(() => run(engine)).toThrow(
      'Channel "jobs" payload 1 requires int but received bool',
    )
    expect(engine.getState().channelStates?.jobs.messages).toEqual([])
  })

  it('enqueues and records the event after a suspended function argument', () => {
    const engine = createEngine(`
      function next() { return 42; }
      chan jobs(int);

      process Producer {
        send jobs(next());
      }
    `)

    run(engine)

    expect(engine.getState().channelStates?.jobs.messages)
      .toEqual([{ values: [42] }])
    expect(
      engine.getState().history
        .filter((event) => event.messagePassingEvent)
        .map((event) => event.messagePassingEvent),
    ).toEqual([{
      operation: 'SEND',
      channelName: 'jobs',
      status: 'SUCCEEDED',
      messageCountBefore: 0,
      messageCountAfter: 1,
      values: [42],
    }])
  })

  it('keeps fork, reset and rewind mailbox state independent', () => {
    const engine = createEngine(`
      chan jobs(int);
      process Producer { send jobs(7); }
    `)
    const fork = engine.fork()

    expect(fork.step()).toBe(true)
    expect(fork.getState().channelStates?.jobs.messages)
      .toEqual([{ values: [7] }])
    expect(engine.getState().channelStates?.jobs.messages).toEqual([])

    fork.rewindToStep(0)
    expect(fork.getState().channelStates?.jobs.messages).toEqual([])

    expect(fork.step()).toBe(true)
    fork.reset()
    expect(fork.getState().channelStates?.jobs.messages).toEqual([])
  })
})
