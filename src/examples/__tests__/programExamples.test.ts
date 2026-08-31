import { describe, expect, it } from 'vitest'
import { createExecutionState } from '../../core/engine/createExecutionState'
import { SimulationEngine } from '../../core/engine/SimulationEngine'
import { parseProgram } from '../../core/language/parseProgram'
import { FirstReadyScheduler } from '../../core/scheduler/FirstReadyScheduler'
import { RoundRobinScheduler } from '../../core/scheduler/RoundRobinScheduler'
import type { ProgramExample } from '../ProgramExample'
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
  it('contains a problem and solution for each of the nine M7 topics', () => {
    expect(programExamples).toHaveLength(18)
    expect(new Set(
      programExamples.map((example) => example.id),
    ).size).toBe(programExamples.length)
    expect(programExamples.every(
      (example) => example.category === 'SEMAPHORES',
    )).toBe(true)

    const topicIds = new Set(
      programExamples.map((example) => example.topicId),
    )

    expect(topicIds.size).toBe(9)

    for (const topicId of topicIds) {
      expect(
        programExamples
          .filter((example) => example.topicId === topicId)
          .map((example) => example.variant)
          .sort(),
      ).toEqual(['PROBLEM', 'SOLUTION'])
    }
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
})
