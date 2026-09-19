import { describe, expect, it } from 'vitest'
import { createExecutionState } from '../../core/engine/createExecutionState'
import { SimulationEngine } from '../../core/engine/SimulationEngine'
import { parseProgram } from '../../core/language/parseProgram'
import { FirstReadyScheduler } from '../../core/scheduler/FirstReadyScheduler'
import { RoundRobinScheduler } from '../../core/scheduler/RoundRobinScheduler'
import type { ProgramExample } from '../ProgramExample'
import {
  monitorBoundedBufferExample,
  monitorBoundedBufferProblemExample,
} from '../monitorExamples'
import {
  messagePassingClientServerExample,
  messagePassingEmptyRaceProblemExample,
  messagePassingEventSignalingExample,
  messagePassingMultipleWaitersExample,
  messagePassingUnitBufferExample,
} from '../messagePassingExamples'
import { programExamples } from '../programExamples'
import {
  candyMutualExclusionProblemExample,
  countedBufferProblemExample,
  countingSemaphoreProblemExample,
  diningPhilosophersProblemExample,
  eventSignalingProblemExample,
  multipleWaitersProblemExample,
  readerPreferenceProblemExample,
  threeProcessBarrierProblemExample,
  unitBufferProblemExample,
} from '../semaphoreExamples'

function runUntilNoProgress(
  example: ProgramExample,
): SimulationEngine {
  const scheduler = example.recommendedScheduler
    === 'FIRST_READY'
    ? new FirstReadyScheduler()
    : new RoundRobinScheduler()
  const engine = new SimulationEngine(
    createExecutionState(parseProgram(example.source)),
    scheduler,
    500,
  )

  while (engine.step()) {
    // Run the deterministic example to its terminal state.
  }

  return engine
}

describe('educational program catalogue', () => {
  it('contains a problem and solution for every educational topic', () => {
    expect(programExamples).toHaveLength(25)
    expect(new Set(
      programExamples.map((example) => example.id),
    ).size).toBe(programExamples.length)

    const topicIds = new Set(
      programExamples.map((example) => example.topicId),
    )

    expect(topicIds.size).toBe(10)

    for (const topicId of topicIds) {

      expect(
        programExamples
          .filter((example) =>
            example.topicId === topicId,
          )
          .map((example) => example.variant)
          .includes('PROBLEM'),
      ).toBe(true)
      expect(
        programExamples
          .filter((example) =>
            example.topicId === topicId,
          )
          .map((example) => example.variant)
          .includes('SOLUTION'),
      ).toBe(true)
    }

    expect(programExamples.filter(
      (example) => example.category === 'SEMAPHORES',
    )).toHaveLength(18)
    expect(programExamples.filter(
      (example) => example.category === 'MONITORS',
    )).toHaveLength(2)
    expect(programExamples.filter(
      (example) => example.category === 'MESSAGE_PASSING',
    )).toHaveLength(5)
  })

  it('keeps every shared example executable by the real parser', () => {
    for (const example of programExamples) {
      const program = parseProgram(example.source)

      expect(program.processes.length).toBeGreaterThan(0)
      expect(example.title.length).toBeGreaterThan(0)
      expect(example.description.length).toBeGreaterThan(0)
    }
  })

  it('makes every synchronization error reproducible with the recommended scheduler', () => {
    const deadlockExamples = [
      eventSignalingProblemExample,
      multipleWaitersProblemExample,
      unitBufferProblemExample,
      threeProcessBarrierProblemExample,
      diningPhilosophersProblemExample,
    ]

    for (const example of deadlockExamples) {
      expect(
        runUntilNoProgress(example)
          .getExecutionDiagnostic().status,
        example.id,
      ).toBe('DEADLOCK')
    }
  })

  it('makes every incorrect data result reproducible with the recommended scheduler', () => {
    const candyEngine = runUntilNoProgress(
      candyMutualExclusionProblemExample,
    )
    expect(candyEngine.getSnapshot().sharedMemory.cant).toBe(1)
    expect(
      candyEngine.getSnapshot().memoryAccessConflicts.some(
        (conflict) => conflict.classification === 'POTENTIAL_RACE',
      ),
    ).toBe(true)

    const resourceEngine = runUntilNoProgress(
      countingSemaphoreProblemExample,
    )
    expect(
      resourceEngine.getSnapshot().sharedMemory.maximoObservado,
    ).toBe(3)

    const bufferEngine = runUntilNoProgress(
      countedBufferProblemExample,
    )
    expect(
      bufferEngine.getSnapshot().sharedMemory.consumidos,
    ).toEqual([30, 20, 30])

    const readersEngine = runUntilNoProgress(
      readerPreferenceProblemExample,
    )
    expect(
      readersEngine.getSnapshot().memoryAccessConflicts.some(
        (conflict) => conflict.classification === 'POTENTIAL_RACE',
      ),
    ).toBe(true)
  })

  it('reproduces the missing monitor notification as a terminal block', () => {
    const engine = runUntilNoProgress(
      monitorBoundedBufferProblemExample,
    )
    const snapshot = engine.getSnapshot()
    const monitor = snapshot.monitors[0]

    expect(snapshot.executionStatus).toBe('DEADLOCK')
    expect(
      snapshot.processes.find(
        (process) => process.id === 'Consumer',
      )?.localMemory.received,
    ).toEqual([10, 20, 0])
    expect(monitor.conditions).toEqual([
      {
        name: 'notFull',
        waitingProcessIds: ['Producer'],
      },
      {
        name: 'notEmpty',
        waitingProcessIds: ['Consumer'],
      },
    ])
  })

  it('runs the corrected monitor buffer to completion', () => {
    const engine = runUntilNoProgress(
      monitorBoundedBufferExample,
    )
    const snapshot = engine.getSnapshot()
    const consumer = snapshot.processes.find(
      (process) => process.id === 'Consumer',
    )

    expect(snapshot.executionStatus).toBe('FINISHED')
    expect(consumer?.localMemory.received).toEqual([
      10,
      20,
      30,
    ])
    expect(snapshot.monitors[0].memory.items).toMatchObject({
      kind: 'QUEUE',
      items: [],
    })
    expect(snapshot.monitors[0].conditions.every(
      (condition) => condition.waitingProcessIds.length === 0,
    )).toBe(true)
    expect(engine.getState().history.some(
      (event) =>
        event.monitorConditionEvent?.status === 'WAITING',
    )).toBe(true)
    expect(engine.getState().history.some(
      (event) =>
        event.monitorConditionEvent?.status === 'SIGNALED',
    )).toBe(true)
  })

  it('runs the finite message-passing client/server example to completion', () => {
    const engine = runUntilNoProgress(
      messagePassingClientServerExample,
    )
    const snapshot = engine.getSnapshot()

    expect(snapshot.executionStatus).toBe('FINISHED')
    expect(snapshot.processes
      .filter((process) => process.id.startsWith('Client['))
      .map((process) => process.localMemory.response))
      .toEqual([20, 40, 60])
    expect(snapshot.channels.every(
      (channel) =>
        channel.messages.length === 0
        && channel.waitingProcessIds.length === 0,
    )).toBe(true)

    const messageEvents = engine.getState().history
      .flatMap((event) =>
        event.messagePassingEvent
          ? [event.messagePassingEvent]
          : [],
      )

    expect(messageEvents.filter(
      (event) => event.operation === 'SEND',
    )).toHaveLength(6)
    expect(messageEvents.filter(
      (event) =>
        event.operation === 'RECEIVE'
        && event.status === 'SUCCEEDED',
    )).toHaveLength(6)
    expect(messageEvents.some(
      (event) =>
        event.operation === 'RECEIVE'
        && event.status === 'BLOCKED',
    )).toBe(true)
  })

  it('reproduces the stale empty observation with competing receivers', () => {
    const engine = runUntilNoProgress(
      messagePassingEmptyRaceProblemExample,
    )
    const snapshot = engine.getSnapshot()
    const servers = snapshot.processes.filter(
      (process) => process.id.startsWith('Server['),
    )

    expect(snapshot.executionStatus).toBe('DEADLOCK')
    expect(snapshot.deadlock).toEqual(
      expect.objectContaining({
        kind: 'TERMINAL_BLOCKING',
        involvedResources: [
          expect.objectContaining({
            id: 'CHANNEL:requests',
            kind: 'CHANNEL',
          }),
        ],
      }),
    )
    expect(servers.map(
      (server) => server.localMemory.sawRequest,
    )).toEqual([true, true])
    expect(snapshot.channels.find(
      (channel) => channel.name === 'requests',
    )).toMatchObject({
      messages: [],
      waitingProcessIds: ['Server[1]'],
    })
    expect(snapshot.processes.find(
      (process) => process.id === 'Client',
    )?.localMemory.response).toBe(20)
    expect(engine.getState().history.some(
      (event) =>
        event.processId === 'Server[1]'
        && event.messagePassingEvent?.operation === 'RECEIVE'
        && event.messagePassingEvent.status === 'BLOCKED',
    )).toBe(true)
  })

  it('runs message-passing alternatives for existing catalogue topics', () => {
    const eventEngine = runUntilNoProgress(
      messagePassingEventSignalingExample,
    )
    const waitersEngine = runUntilNoProgress(
      messagePassingMultipleWaitersExample,
    )
    const bufferEngine = runUntilNoProgress(
      messagePassingUnitBufferExample,
    )

    expect(eventEngine.getSnapshot().executionStatus).toBe('FINISHED')
    expect(eventEngine.getSnapshot().processes.find(
      (process) => process.id === 'Worker',
    )?.localMemory.began).toBe(true)

    expect(waitersEngine.getSnapshot().executionStatus).toBe('FINISHED')
    expect(waitersEngine.getSnapshot().processes
      .filter((process) => process.id.startsWith('Worker['))
      .map((process) => process.localMemory.began))
      .toEqual([true, true])

    expect(bufferEngine.getSnapshot().executionStatus).toBe('FINISHED')
    expect(bufferEngine.getSnapshot().processes.find(
      (process) => process.id === 'Consumer',
    )?.localMemory.consumed).toBe(42)

    for (const engine of [
      eventEngine,
      waitersEngine,
      bufferEngine,
    ]) {
      expect(engine.getSnapshot().channels.every(
        (channel) =>
          channel.messages.length === 0
          && channel.waitingProcessIds.length === 0,
      )).toBe(true)
      expect(engine.getState().history.some(
        (event) =>
          event.messagePassingEvent?.operation === 'SEND',
      )).toBe(true)
      expect(engine.getState().history.some(
        (event) =>
          event.messagePassingEvent?.operation === 'RECEIVE'
          && event.messagePassingEvent.status === 'SUCCEEDED',
      )).toBe(true)
    }

    expect(waitersEngine.getState().history.some(
      (event) =>
        event.messagePassingEvent?.operation === 'RECEIVE'
        && event.messagePassingEvent.status === 'BLOCKED',
    )).toBe(true)
  })
})
