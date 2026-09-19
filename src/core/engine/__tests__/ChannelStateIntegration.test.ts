import { describe, expect, it } from 'vitest'
import { createSemanticStateKey } from '../../exploration/createSemanticStateKey'
import { projectSemanticExecutionState } from '../../exploration/SemanticExecutionState'
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

describe('channel state integration', () => {
  it('exposes detached channel messages and receivers in snapshots', () => {
    const engine = createEngine(`
      chan jobs(int);

      process Receiver {
        int result;
        receive jobs(result);
      }
    `)

    engine.getState().channelStates.jobs.messages.push({
      values: [7],
    })
    engine.step()
    engine.getState().channelStates.jobs.messages.length = 0
    engine.step()

    const snapshot = engine.getSnapshot()

    expect(snapshot.channels).toEqual([{
      name: 'jobs',
      payloadTypes: [{
        kind: 'PRIMITIVE',
        primitiveType: 'int',
      }],
      messages: [],
      waitingProcessIds: ['Receiver'],
    }])

    snapshot.channels[0].messages.push({ values: [99] })
    expect(engine.getState().channelStates.jobs.messages).toEqual([])
  })

  it('includes mailbox contents and FIFO order in semantic state keys', () => {
    const first = createExecutionState(parseProgram('chan jobs(int);'))
    const second = createExecutionState(parseProgram('chan jobs(int);'))
    const third = createExecutionState(parseProgram('chan jobs(int);'))

    first.channelStates.jobs.messages.push(
      { values: [1] },
      { values: [2] },
    )
    second.channelStates.jobs.messages.push(
      { values: [2] },
      { values: [1] },
    )
    third.channelStates.jobs.messages.push({ values: [1] })

    expect(createSemanticStateKey(first)).not.toBe(
      createSemanticStateKey(second),
    )
    expect(createSemanticStateKey(first)).not.toBe(
      createSemanticStateKey(third),
    )
  })

  it('returns detached channel state from the semantic projection', () => {
    const engine = createEngine(`
      chan jobs(int);
      process Producer { send jobs(5); }
    `)

    engine.step()
    const semantic = projectSemanticExecutionState(
      engine.getState(),
    )

    semantic.channelStates.jobs.messages[0].values[0] = 99

    expect(engine.getState().channelStates.jobs.messages)
      .toEqual([{ values: [5] }])
  })

  it('restores mailbox snapshots through Step Back', () => {
    const engine = createEngine(`
      chan jobs(int);
      process Producer {
        send jobs(1);
        send jobs(2);
      }
    `)

    const snapshots = [engine.getSnapshot()]

    engine.step()
    snapshots.push(engine.getSnapshot())
    engine.step()
    snapshots.push(engine.getSnapshot())

    engine.stepBack()
    expect(engine.getSnapshot()).toEqual(snapshots[1])

    engine.stepBack()
    expect(engine.getSnapshot()).toEqual(snapshots[0])
  })

  it('projects the latest channel event as reconstructible visual focus', () => {
    const engine = createEngine(`
      chan jobs(int);
      process Producer { send jobs(5); }
    `)

    engine.step()

    expect(engine.getSnapshot().executionFocus)
      .toMatchObject({
        step: 1,
        processId: 'Producer',
        messagePassingEvent: {
          operation: 'SEND',
          channelName: 'jobs',
          status: 'SUCCEEDED',
          messageCountBefore: 0,
          messageCountAfter: 1,
          values: [5],
        },
      })

    engine.stepBack()
    expect(engine.getSnapshot().executionFocus).toBeUndefined()
  })
})
