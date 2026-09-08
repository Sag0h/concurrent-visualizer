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
  it('contains a problem and solution for every topic and mechanism', () => {
    expect(programExamples).toHaveLength(20)
    expect(new Set(
      programExamples.map((example) => example.id),
    ).size).toBe(programExamples.length)

    const topicAndCategory = new Set(
      programExamples.map(
        (example) => `${example.category}:${example.topicId}`,
      ),
    )

    expect(topicAndCategory.size).toBe(10)

    for (const key of topicAndCategory) {
      const [category, topicId] = key.split(':')

      expect(
        programExamples
          .filter((example) =>
            example.category === category
            && example.topicId === topicId,
          )
          .map((example) => example.variant)
          .sort(),
      ).toEqual(['PROBLEM', 'SOLUTION'])
    }

    expect(programExamples.filter(
      (example) => example.category === 'SEMAPHORES',
    )).toHaveLength(18)
    expect(programExamples.filter(
      (example) => example.category === 'MONITORS',
    )).toHaveLength(2)
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
})
