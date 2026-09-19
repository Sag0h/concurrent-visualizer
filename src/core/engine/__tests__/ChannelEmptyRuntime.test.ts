import { describe, expect, it } from 'vitest'
import { parseProgram } from '../../language/parseProgram'
import { FirstReadyScheduler } from '../../scheduler/FirstReadyScheduler'
import { createExecutionState } from '../createExecutionState'
import type { EnabledTransition } from '../EnabledTransition'
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

function transitionFor(
  engine: SimulationEngine,
  processId: string,
): EnabledTransition {
  const transition = engine.getEnabledTransitions().find(
    (candidate) => candidate.processId === processId,
  )

  if (!transition) {
    throw new Error(`No enabled transition for ${processId}`)
  }

  return transition
}

function stepProcess(
  engine: SimulationEngine,
  processId: string,
): void {
  engine.stepTransition(transitionFor(engine, processId))
}

describe('empty(channel) runtime', () => {
  it('observes mailbox changes without mutating or emitting an event', () => {
    const engine = createEngine(`
      chan jobs(int);

      process Worker {
        bool initiallyEmpty = empty(jobs);
        send jobs(7);
        bool emptyAfterSend = empty(jobs);
        int value;
        receive jobs(value);
        bool emptyAfterReceive = empty(jobs);
      }
    `)

    run(engine)

    expect(engine.getState().program.processes[0].localMemory)
      .toMatchObject({
        initiallyEmpty: true,
        emptyAfterSend: false,
        value: 7,
        emptyAfterReceive: true,
      })
    expect(
      engine.getState().history.filter(
        (event) => event.messagePassingEvent,
      ),
    ).toHaveLength(2)
  })

  it('resolves indexed channels including suspended function indexes', () => {
    const engine = createEngine(`
      function target() { return 1; }
      chan replies[2](string);

      process Worker {
        send replies[1]("ready");
        bool firstEmpty = empty(replies[0]);
        bool secondEmpty = empty(replies[target()]);
      }
    `)

    run(engine)

    expect(engine.getState().program.processes[0].localMemory)
      .toMatchObject({
        firstEmpty: true,
        secondEmpty: false,
      })
  })

  it('does not reserve a message observed as available', () => {
    const engine = createEngine(`
      chan jobs(int);

      process Producer {
        send jobs(9);
      }

      process Observer {
        bool available = !empty(jobs);
        int value;
        receive jobs(value);
      }

      process Competitor {
        int value;
        receive jobs(value);
      }
    `)

    stepProcess(engine, 'Producer')
    stepProcess(engine, 'Observer')
    stepProcess(engine, 'Competitor')
    stepProcess(engine, 'Competitor')
    stepProcess(engine, 'Observer')
    stepProcess(engine, 'Observer')

    expect(engine.getState().program.processes[1]).toMatchObject({
      state: 'BLOCKED',
      blockingReason: {
        type: 'CHANNEL_RECEIVE',
        channelName: 'jobs',
      },
      localMemory: {
        available: true,
      },
    })
    expect(engine.getState().program.processes[2].localMemory.value)
      .toBe(9)
  })

  it('can reactivate an await guard after a send', () => {
    const engine = createEngine(`
      chan jobs(int);

      process Consumer {
        await (!empty(jobs));
        int value;
        receive jobs(value);
      }

      process Producer {
        send jobs(11);
      }
    `)

    stepProcess(engine, 'Consumer')
    expect(engine.getState().program.processes[0].state).toBe('BLOCKED')

    stepProcess(engine, 'Producer')
    expect(
      engine.getEnabledTransitions().map(
        (transition) => transition.processId,
      ),
    ).toContain('Consumer')

    stepProcess(engine, 'Consumer')
    stepProcess(engine, 'Consumer')
    stepProcess(engine, 'Consumer')

    expect(engine.getState().program.processes[0].localMemory.value)
      .toBe(11)
  })

  it('validates a calculated array index at runtime', () => {
    const engine = createEngine(`
      chan replies[2](string);

      process Worker {
        int index = 2;
        bool result = empty(replies[index]);
      }
    `)

    expect(engine.step()).toBe(true)
    expect(() => engine.step()).toThrow(
      'Channel index 2 is out of bounds for "replies"',
    )
  })
})
