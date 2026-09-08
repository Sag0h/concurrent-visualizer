import { describe, expect, it } from 'vitest'
import { exploreForDeadlock } from '../../exploration/exploreForDeadlock'
import { parseProgram } from '../../language/parseProgram'
import { RoundRobinScheduler } from '../../scheduler/RoundRobinScheduler'
import { createExecutionState } from '../createExecutionState'
import { SimulationEngine } from '../SimulationEngine'

function createEngine(
  source: string,
): SimulationEngine {
  return new SimulationEngine(
    createExecutionState(parseProgram(source)),
    new RoundRobinScheduler(),
    200,
  )
}

function runUntilNoProgress(
  engine: SimulationEngine,
): void {
  while (
    !engine.isFinished()
    && !engine.hasReachedStepLimit()
    && engine.step()
  ) {
    // The engine determines when no process can advance.
  }
}

describe('monitor condition variables', () => {
  it('parses conditions and their three academic operations', () => {
    const program = parseProgram(`
      monitor Gate {
        cond first, second;

        procedure coordinate() {
          wait(first);
          signal(first);
          signal_all(second);
        }
      }
    `)

    expect(program.monitors?.Gate.conditions).toEqual([
      { name: 'first' },
      { name: 'second' },
    ])
    expect(
      program.monitors?.Gate.procedures.coordinate.body,
    ).toMatchObject([
      {
        type: 'MONITOR_WAIT',
        conditionName: 'first',
      },
      {
        type: 'MONITOR_SIGNAL',
        conditionName: 'first',
      },
      {
        type: 'MONITOR_SIGNAL_ALL',
        conditionName: 'second',
      },
    ])
  })

  it('coordinates a producer and consumer without busy waiting', () => {
    const engine = createEngine(`
      monitor Buffer {
        int data = 0;
        bool hasData = false;
        cond canProduce, canConsume;

        procedure send(in int value) {
          while (hasData) {
            wait(canProduce);
          }

          data = value;
          hasData = true;
          signal(canConsume);
        }

        procedure receive(out int value) {
          while (!hasData) {
            wait(canConsume);
          }

          value = data;
          hasData = false;
          signal(canProduce);
        }
      }

      process Consumer {
        int result;
        Buffer.receive(result);
        print(result);
      }

      process Producer {
        Buffer.send(42);
      }
    `)

    runUntilNoProgress(engine)

    const snapshot = engine.getSnapshot()
    const consumer = snapshot.processes.find(
      (process) => process.id === 'Consumer',
    )

    expect(engine.isFinished()).toBe(true)
    expect(consumer?.localMemory.result).toBe(42)
    expect(snapshot.monitors[0].memory).toMatchObject({
      data: 42,
      hasData: false,
    })
    expect(snapshot.monitors[0].conditions).toEqual([
      {
        name: 'canProduce',
        waitingProcessIds: [],
      },
      {
        name: 'canConsume',
        waitingProcessIds: [],
      },
    ])
  })

  it('uses signal-and-continue before the waiter competes to reenter', () => {
    const engine = createEngine(`
      monitor Gate {
        int phase = 0;
        cond open;

        procedure awaitOpen() {
          wait(open);
          phase = phase + 1;
        }

        procedure openGate() {
          signal(open);
          phase = 10;
        }
      }

      process Waiter {
        Gate.awaitOpen();
      }

      process Signaler {
        Gate.openGate();
      }
    `)

    while (
      !engine.getState().history.some(
        (event) => event.instructionType === 'MONITOR_SIGNAL',
      )
    ) {
      expect(engine.step()).toBe(true)
    }

    const state = engine.getState()
    const waiter = state.program.processes.find(
      (process) => process.id === 'Waiter',
    )

    expect(state.monitorStates?.Gate.ownerProcessId).toBe(
      'Signaler',
    )
    expect(waiter?.state).toBe('BLOCKED')
    expect(waiter?.blockingReason).toEqual({
      type: 'MONITOR_CONDITION',
      monitorName: 'Gate',
      conditionName: 'open',
      phase: 'REACQUIRE',
    })
    expect(
      state.monitorStates?.Gate.entryContenderProcessIds,
    ).toContain('Waiter')
    expect(
      state.monitorStates?.Gate.conditions.open.waitingProcessIds,
    ).toEqual([])

    runUntilNoProgress(engine)

    expect(engine.isFinished()).toBe(true)
    expect(
      engine.getSnapshot().monitors[0].memory.phase,
    ).toBe(11)
  })

  it('signals condition waiters in FIFO order', () => {
    const engine = createEngine(`
      monitor Gate {
        cond turn;

        procedure waitTurn() {
          wait(turn);
        }

        procedure wakeTwo() {
          signal(turn);
          signal(turn);
        }
      }

      process W1 { Gate.waitTurn(); }
      process W2 { Gate.waitTurn(); }
      process W3 { Gate.waitTurn(); }
      process Signaler { Gate.wakeTwo(); }
    `)

    runUntilNoProgress(engine)

    const signalEvents = engine.getState().history
      .map((event) => event.monitorConditionEvent)
      .filter((event) => event?.operation === 'SIGNAL')

    expect(signalEvents.map(
      (event) => event?.awakenedProcessIds,
    )).toEqual([['W1'], ['W2']])
    expect(
      engine.getSnapshot().monitors[0]
        .conditions[0].waitingProcessIds,
    ).toEqual(['W3'])
  })

  it('broadcasts to every waiter with signal_all', () => {
    const engine = createEngine(`
      monitor Barrier {
        cond ready;

        procedure awaitReady() {
          wait(ready);
        }

        procedure releaseAll() {
          signal_all(ready);
        }
      }

      process W1 { Barrier.awaitReady(); }
      process W2 { Barrier.awaitReady(); }
      process Coordinator { Barrier.releaseAll(); }
    `)

    runUntilNoProgress(engine)

    const broadcast = engine.getState().history.find(
      (event) =>
        event.monitorConditionEvent?.operation
          === 'SIGNAL_ALL',
    )?.monitorConditionEvent

    expect(engine.isFinished()).toBe(true)
    expect(broadcast?.awakenedProcessIds).toEqual([
      'W1',
      'W2',
    ])
  })

  it('does not preserve a signal when nobody is waiting', () => {
    const engine = createEngine(`
      monitor Gate {
        cond open;

        procedure notify() {
          signal(open);
        }

        procedure awaitOpen() {
          wait(open);
        }
      }

      process Signaler { Gate.notify(); }
      process Waiter { Gate.awaitOpen(); }
    `)

    runUntilNoProgress(engine)

    const snapshot = engine.getSnapshot()
    const signal = engine.getState().history.find(
      (event) =>
        event.monitorConditionEvent?.operation
          === 'SIGNAL',
    )?.monitorConditionEvent

    expect(engine.isFinished()).toBe(false)
    expect(snapshot.executionStatus).toBe('DEADLOCK')
    expect(signal?.status).toBe('NO_WAITER')
    expect(
      snapshot.monitors[0].conditions[0].waitingProcessIds,
    ).toEqual(['Waiter'])
    expect(snapshot.deadlock?.involvedResources).toEqual([
      {
        id: 'CONDITION:Gate.open',
        kind: 'CONDITION',
        name: 'Gate.open',
      },
    ])
  })

  it('clones and rewinds condition queues', () => {
    const engine = createEngine(`
      monitor Gate {
        cond open;

        procedure awaitOpen() {
          wait(open);
        }
      }

      process Waiter { Gate.awaitOpen(); }
    `)

    expect(engine.step()).toBe(true)
    expect(engine.step()).toBe(true)

    const fork = engine.fork()

    expect(
      engine.getSnapshot().monitors[0]
        .conditions[0].waitingProcessIds,
    ).toEqual(['Waiter'])
    expect(engine.stepBack()).toBe(true)
    expect(
      engine.getSnapshot().monitors[0]
        .conditions[0].waitingProcessIds,
    ).toEqual([])
    expect(
      engine.getSnapshot().monitors[0].ownerProcessId,
    ).toBe('Waiter')
    expect(
      fork.getSnapshot().monitors[0]
        .conditions[0].waitingProcessIds,
    ).toEqual(['Waiter'])
  })

  it('includes condition queues in deadlock exploration', () => {
    const engine = createEngine(`
      monitor Gate {
        cond open;

        procedure notify() {
          signal(open);
        }

        procedure awaitOpen() {
          wait(open);
        }
      }

      process Signaler { Gate.notify(); }
      process Waiter { Gate.awaitOpen(); }
    `)

    const result = exploreForDeadlock(engine, {
      maxDepth: 10,
      maxStates: 100,
    })

    expect(result.status).toBe('FOUND')
    expect(result.counterexample?.diagnostic.kind).toBe(
      'TERMINAL_BLOCKING',
    )
    expect(
      result.counterexample?.diagnostic.involvedResources,
    ).toContainEqual({
      id: 'CONDITION:Gate.open',
      kind: 'CONDITION',
      name: 'Gate.open',
    })
  })

  it('rejects invalid condition declarations and uses', () => {
    expect(() => parseProgram(`
      monitor Gate {
        int open = 0;
        cond open;
      }
    `)).toThrow(
      'Condition "open" conflicts with private state in monitor "Gate"',
    )

    expect(() => parseProgram(`
      process Invalid {
        wait(open);
      }
    `)).toThrow(
      '"wait" can only be used inside a monitor procedure',
    )

    const unknown = createEngine(`
      monitor Gate {
        procedure invalid() {
          wait(missing);
        }
      }

      process P1 { Gate.invalid(); }
    `)

    expect(unknown.step()).toBe(true)
    expect(() => unknown.step()).toThrow(
      'Condition "missing" is not defined in monitor "Gate"',
    )
  })
})
