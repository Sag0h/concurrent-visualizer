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

describe('PMA channel receive runtime', () => {
  it('dequeues messages in FIFO order and emits structured events', () => {
    const engine = createEngine(`
      chan jobs(int);

      process Producer {
        send jobs(10);
        send jobs(20);
      }

      process Consumer {
        int first;
        int second;
        receive jobs(first);
        receive jobs(second);
      }
    `)

    run(engine)

    expect(engine.getState().channelStates.jobs.messages).toEqual([])
    expect(engine.getState().program.processes[1].localMemory)
      .toMatchObject({ first: 10, second: 20 })
    expect(
      engine.getState().history
        .filter((event) =>
          event.messagePassingEvent?.operation === 'RECEIVE',
        )
        .map((event) => event.messagePassingEvent),
    ).toEqual([
      {
        operation: 'RECEIVE',
        channelName: 'jobs',
        status: 'SUCCEEDED',
        messageCountBefore: 2,
        messageCountAfter: 1,
        values: [10],
      },
      {
        operation: 'RECEIVE',
        channelName: 'jobs',
        status: 'SUCCEEDED',
        messageCountBefore: 1,
        messageCountAfter: 0,
        values: [20],
      },
    ])
  })

  it('writes an entire tuple to every supported local target shape', () => {
    const engine = createEngine(`
      record Result { int value; }
      chan results(int, int, int, int);

      process Producer {
        send results(1, 2, 3, 4);
      }

      process Consumer {
        int direct;
        int[] values = [0];
        Result result = Result { value: 0 };
        Result[] records = [Result { value: 0 }];
        receive results(
          direct,
          values[0],
          result.value,
          records[0].value
        );
      }
    `)

    run(engine)

    const memory = engine.getState().program.processes[1].localMemory

    expect(memory.direct).toBe(1)
    expect(memory.values).toEqual([2])
    expect(memory.result).toMatchObject({ fields: { value: 3 } })
    expect(memory.records).toEqual([expect.objectContaining({
      fields: { value: 4 },
    })])
  })

  it('supports a suspended function call in the channel index', () => {
    const engine = createEngine(`
      function target() { return 1; }
      chan replies[2](string);

      process Producer {
        send replies[1]("ready");
      }

      process Consumer {
        string response;
        receive replies[target()](response);
      }
    `)

    run(engine)

    expect(engine.getState().program.processes[1].localMemory.response)
      .toBe('ready')
  })

  it('does not consume or partially assign when a destination is invalid', () => {
    const engine = createEngine(`
      chan jobs(int, int);

      process Producer {
        send jobs(10, 20);
      }

      process Consumer {
        int direct = 0;
        int[] values = [0];
        receive jobs(direct, values[2]);
      }
    `)

    expect(() => run(engine)).toThrow(
      'Array index 2 is out of bounds',
    )
    expect(engine.getState().channelStates.jobs.messages)
      .toEqual([{ values: [10, 20] }])
    expect(engine.getState().program.processes[1].localMemory)
      .toMatchObject({ direct: 0, values: [0] })
  })

  it('rejects shared receive destinations without consuming the message', () => {
    const engine = createEngine(`
      shared int result = 0;
      chan jobs(int);

      process Producer {
        send jobs(10);
      }

      process Consumer {
        receive jobs(result);
      }
    `)

    expect(() => run(engine)).toThrow(
      'Receive target 1 must use local memory; "result" is shared',
    )
    expect(engine.getState().channelStates.jobs.messages)
      .toEqual([{ values: [10] }])
    expect(engine.getState().program.sharedMemory.result).toBe(0)
  })

  it('keeps empty-channel blocking for the next runtime cut', () => {
    const engine = createEngine(`
      chan jobs(int);
      process Consumer {
        int result;
        receive jobs(result);
      }
    `)

    expect(engine.step()).toBe(true)
    expect(() => engine.step()).toThrow(
      'Receiving from an empty channel will be implemented in the next M13.3 runtime cut',
    )
    expect(engine.getState().channelStates.jobs.messages).toEqual([])
  })
})
