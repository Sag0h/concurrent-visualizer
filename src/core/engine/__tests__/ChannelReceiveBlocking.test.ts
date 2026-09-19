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

describe('PMA receive blocking and reactivation', () => {
  it('preserves the resolved channel while a receiver is blocked', () => {
    const engine = createEngine(`
      shared int target = 0;
      chan replies[2](int);

      process Receiver {
        int result;
        receive replies[target](result);
      }

      process Producer {
        target = 1;
        send replies[0](7);
      }
    `)

    stepProcess(engine, 'Receiver')
    stepProcess(engine, 'Receiver')

    expect(engine.getState().program.processes[0].blockingReason)
      .toEqual({
        type: 'CHANNEL_RECEIVE',
        channelName: 'replies[0]',
      })

    while (
      engine.getState().program.processes[1].programCounter < 1
    ) {
      stepProcess(engine, 'Producer')
    }
    stepProcess(engine, 'Producer')

    expect(engine.getState().program.sharedMemory.target).toBe(1)
    expect(engine.getState().program.processes[0].state).toBe('READY')

    stepProcess(engine, 'Receiver')

    expect(engine.getState().program.processes[0].localMemory.result)
      .toBe(7)
    expect(engine.getState().channelStates['replies[0]'].messages)
      .toEqual([])
  })

  it('reactivates every compatible receiver without reserving the message', () => {
    const engine = createEngine(`
      chan jobs(int);

      process Receiver1 {
        int result;
        receive jobs(result);
      }

      process Receiver2 {
        int result;
        receive jobs(result);
      }

      process Producer {
        send jobs(9);
      }
    `)

    stepProcess(engine, 'Receiver1')
    stepProcess(engine, 'Receiver1')
    stepProcess(engine, 'Receiver2')
    stepProcess(engine, 'Receiver2')
    stepProcess(engine, 'Producer')

    expect(
      engine.getState().program.processes.slice(0, 2).map(
        (process) => ({
          state: process.state,
          blockingReason: process.blockingReason,
        }),
      ),
    ).toEqual([
      {
        state: 'READY',
        blockingReason: {
          type: 'CHANNEL_RECEIVE',
          channelName: 'jobs',
        },
      },
      {
        state: 'READY',
        blockingReason: {
          type: 'CHANNEL_RECEIVE',
          channelName: 'jobs',
        },
      },
    ])
    expect(engine.getState().history.at(-1)?.messagePassingEvent)
      .toMatchObject({
        operation: 'SEND',
        awakenedProcessIds: ['Receiver1', 'Receiver2'],
      })

    stepProcess(engine, 'Receiver1')
    stepProcess(engine, 'Receiver2')

    expect(engine.getState().program.processes[0].localMemory.result)
      .toBe(9)
    expect(engine.getState().program.processes[1]).toMatchObject({
      state: 'BLOCKED',
      blockingReason: {
        type: 'CHANNEL_RECEIVE',
        channelName: 'jobs',
      },
    })
  })

  it('reports terminal blocking when every process awaits an empty channel', () => {
    const engine = createEngine(`
      chan jobs(int);
      process Receiver {
        int result;
        receive jobs(result);
      }
    `)

    expect(engine.step()).toBe(true)
    expect(engine.step()).toBe(true)
    expect(engine.getExecutionDiagnostic().status).toBe('DEADLOCK')
    expect(engine.getEnabledTransitions()).toEqual([])
  })
})
