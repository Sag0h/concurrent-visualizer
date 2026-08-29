import { describe, expect, it } from 'vitest'
import { createExecutionState } from '../../engine/createExecutionState'
import { cloneExecutionState } from '../../engine/cloneExecutionState'
import { SimulationEngine } from '../../engine/SimulationEngine'
import { parseProgram } from '../../language/parseProgram'
import { FirstReadyScheduler } from '../../scheduler/FirstReadyScheduler'
import { createSemanticStateKey } from '../createSemanticStateKey'
import { projectExecutionTrace } from '../ExecutionTrace'
import { projectSemanticExecutionState } from '../SemanticExecutionState'
import { VisitedStateRegistry } from '../VisitedStateRegistry'
import { createAnalyzedStateKey } from '../createAnalyzedStateKey'
import { projectExplorationAnalysisState } from '../ExplorationAnalysisState'

function createEngine(source: string): SimulationEngine {
  return new SimulationEngine(
    createExecutionState(parseProgram(source)),
    new FirstReadyScheduler(),
  )
}

describe('semantic exploration state', () => {
  it('separates semantic state from the growing execution trace', () => {
    const engine = createEngine(`
      process Spinner {
        while (true) { }
      }
    `)
    const initialKey = createSemanticStateKey(
      engine.getState(),
    )
    const initialTrace = projectExecutionTrace(
      engine.getState(),
    )

    engine.step()

    const nextKey = createSemanticStateKey(
      engine.getState(),
    )
    const nextTrace = projectExecutionTrace(
      engine.getState(),
    )

    expect(nextKey).toBe(initialKey)
    expect(initialTrace.stepCount).toBe(0)
    expect(initialTrace.executionEvents).toEqual([])
    expect(nextTrace.stepCount).toBe(1)
    expect(nextTrace.executionEvents).toHaveLength(1)
  })

  it('returns detached semantic and trace projections', () => {
    const engine = createEngine(`
      shared int value = 1;

      process P1 {
        value = value + 1;
      }
    `)
    const semantic = projectSemanticExecutionState(
      engine.getState(),
    )
    const trace = projectExecutionTrace(
      engine.getState(),
    )

    semantic.program.sharedMemory.value = 99
    trace.executionEvents.push({
      step: 99,
      processId: 'Synthetic',
      instructionType: 'NO_OP',
    })

    expect(
      engine.getState().program.sharedMemory.value,
    ).toBe(1)
    expect(engine.getState().history).toEqual([])
  })

  it('returns a detached analysis projection', () => {
    const engine = createEngine(`
      sem mutex = 1;

      process P1 {
        P(mutex);
      }
    `)

    engine.step()

    const analysis = projectExplorationAnalysisState(
      engine.getState(),
    )

    analysis.memory.semaphoreEvents.length = 0
    analysis.memory.initialSemaphoreValues.mutex = 99

    expect(
      engine.getState().analysisState
        ?.memory.semaphoreEvents,
    ).toHaveLength(1)
    expect(
      engine.getState().analysisState
        ?.memory.initialSemaphoreValues.mutex,
    ).toBe(1)
  })

  it('includes analysis metadata only in the analyzed-state key', () => {
    const engine = createEngine(`
      sem mutex = 1;

      process P1 { }
    `)
    const first = cloneExecutionState(
      engine.getState(),
    )
    const second = cloneExecutionState(first)

    second.analysisState?.memory.semaphoreEvents.push({
      step: 1,
      processId: 'P1',
      instructionType: 'SEMAPHORE_P',
      semaphoreEvent: {
        operation: 'P',
        semaphoreName: 'mutex',
        status: 'SUCCEEDED',
        valueBefore: 1,
        valueAfter: 0,
      },
    })

    expect(createSemanticStateKey(second)).toBe(
      createSemanticStateKey(first),
    )
    expect(createAnalyzedStateKey(second)).not.toBe(
      createAnalyzedStateKey(first),
    )
  })

  it('normalizes object key order', () => {
    const firstState = createExecutionState(
      parseProgram(`
        shared int first = 1;
        shared int second = 2;

        process P1 { }
      `),
    )
    const secondState = cloneExecutionState(
      firstState,
    )

    secondState.program.sharedMemory = {
      second: 2,
      first: 1,
    }

    expect(createSemanticStateKey(secondState)).toBe(
      createSemanticStateKey(firstState),
    )
  })

  it('distinguishes memory, semaphore and control-state changes', () => {
    const engine = createEngine(`
      sem gate = 1;
      shared int value = 0;

      process P1 {
        int local = 1;
      }
    `)
    const initialState = cloneExecutionState(
      engine.getState(),
    )
    const initialKey = createSemanticStateKey(
      initialState,
    )

    const memoryState = cloneExecutionState(initialState)
    memoryState.program.sharedMemory.value = 1

    const semaphoreState = cloneExecutionState(initialState)
    semaphoreState.program.semaphores!.gate.value = 0

    engine.step()

    expect(createSemanticStateKey(memoryState)).not.toBe(
      initialKey,
    )
    expect(createSemanticStateKey(semaphoreState)).not.toBe(
      initialKey,
    )
    expect(createSemanticStateKey(engine.getState())).not.toBe(
      initialKey,
    )
  })

  it('detects a repeated semantic state independently of its trace', () => {
    const engine = createEngine(`
      process Spinner {
        while (true) { }
      }
    `)
    const visited = new VisitedStateRegistry()

    expect(visited.visit(engine.getState())).toBe('NEW')

    engine.step()

    expect(visited.has(engine.getState())).toBe(true)
    expect(visited.visit(engine.getState())).toBe('REPEATED')
    expect(visited.size).toBe(1)
  })

  it('registers a genuinely different semantic successor', () => {
    const engine = createEngine(`
      process P1 {
        int value = 1;
      }
    `)
    const visited = new VisitedStateRegistry()

    expect(visited.visit(engine.getState())).toBe('NEW')

    engine.step()

    expect(visited.visit(engine.getState())).toBe('NEW')
    expect(visited.size).toBe(2)
  })
})
