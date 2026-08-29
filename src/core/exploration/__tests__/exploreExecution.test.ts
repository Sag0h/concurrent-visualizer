import { describe, expect, it } from 'vitest'
import { createExecutionState } from '../../engine/createExecutionState'
import { SimulationEngine } from '../../engine/SimulationEngine'
import { parseProgram } from '../../language/parseProgram'
import { FirstReadyScheduler } from '../../scheduler/FirstReadyScheduler'
import type { ExplorationProperty } from '../ExplorationProperty'
import { createSemanticStateKey } from '../createSemanticStateKey'
import { exploreExecution } from '../exploreExecution'

function createEngine(source: string): SimulationEngine {
  return new SimulationEngine(
    createExecutionState(parseProgram(source)),
    new FirstReadyScheduler(),
    100,
  )
}

describe('exploreExecution', () => {
  it('finds a shortest counterexample for a custom property', () => {
    const engine = createEngine(`
      process P1 {
        int first = 1;
      }

      process P2 {
        int second = 2;
      }
    `)
    const property: ExplorationProperty<
      'PROCESS_FINISHED',
      { readonly processId: string }
    > = {
      kind: 'PROCESS_FINISHED',
      evaluate(state) {
        const process = state.program.processes.find(
          (candidate) => candidate.id === 'P2',
        )

        return process?.state === 'FINISHED'
          ? { processId: process.id }
          : undefined
      },
    }

    const result = exploreExecution(
      engine,
      {
        maxDepth: 4,
        maxStates: 20,
      },
      property,
    )

    expect(result.status).toBe('FOUND')
    expect(result.counterexample).toEqual(
      expect.objectContaining({
        kind: 'PROCESS_FINISHED',
        depth: 1,
        processChoices: ['P2'],
        diagnostic: {
          processId: 'P2',
        },
      }),
    )
    expect(engine.getState().stepCount).toBe(0)
  })

  it('lets a property extend state identity with analysis metadata', () => {
    const engine = createEngine(`
      process Spinner {
        while (true) { }
      }
    `)
    const property: ExplorationProperty<
      'ANALYSIS_STEP_REACHED',
      { readonly step: number }
    > = {
      kind: 'ANALYSIS_STEP_REACHED',
      evaluate(state) {
        return state.stepCount === 2
          ? { step: state.stepCount }
          : undefined
      },
      createStateKey(state) {
        return [
          createSemanticStateKey(state),
          `analysis-step:${state.stepCount}`,
        ].join('|')
      },
    }

    const result = exploreExecution(
      engine,
      {
        maxDepth: 3,
        maxStates: 4,
      },
      property,
    )

    expect(result.status).toBe('FOUND')
    expect(result.counterexample).toEqual(
      expect.objectContaining({
        kind: 'ANALYSIS_STEP_REACHED',
        depth: 2,
        processChoices: [
          'Spinner',
          'Spinner',
        ],
        diagnostic: {
          step: 2,
        },
      }),
    )
    expect(result.statistics.visitedStateCount).toBe(3)
  })

  it('uses semantic state identity by default', () => {
    const engine = createEngine(`
      process Spinner {
        while (true) { }
      }
    `)
    const property: ExplorationProperty<
      'UNREACHABLE_STEP',
      { readonly step: number }
    > = {
      kind: 'UNREACHABLE_STEP',
      evaluate(state) {
        return state.stepCount === 2
          ? { step: state.stepCount }
          : undefined
      },
    }

    const result = exploreExecution(
      engine,
      {
        maxDepth: 3,
        maxStates: 4,
      },
      property,
    )

    expect(result.status).toBe('EXHAUSTED')
    expect(result.statistics).toEqual({
      visitedStateCount: 1,
      exploredTransitionCount: 1,
      maximumDepthReached: 1,
    })
  })
})
