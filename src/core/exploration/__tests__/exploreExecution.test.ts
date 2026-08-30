import { describe, expect, it } from 'vitest'
import { createExecutionState } from '../../engine/createExecutionState'
import { SimulationEngine } from '../../engine/SimulationEngine'
import { parseProgram } from '../../language/parseProgram'
import { FirstReadyScheduler } from '../../scheduler/FirstReadyScheduler'
import {
  isPriorityQueueValue,
  isQueueValue,
  isStackValue,
} from '../../memory/RuntimeValue'
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
  it('explores stack contents as semantic state', () => {
    const engine = createEngine(`
      shared stack<int> values = stack[1];

      process Consumer {
        int value = values.pop();
      }

      process Observer {
        bool untouched = true;
      }
    `)
    const property: ExplorationProperty<
      'STACK_EMPTY',
      { readonly stackName: string }
    > = {
      kind: 'STACK_EMPTY',
      evaluate(state) {
        const stack = state.program.sharedMemory.values

        return isStackValue(stack)
          && stack.items.length === 0
          ? { stackName: 'values' }
          : undefined
      },
    }

    const result = exploreExecution(
      engine,
      { maxDepth: 3, maxStates: 10 },
      property,
    )

    expect(result.status).toBe('FOUND')
    expect(result.counterexample).toEqual(
      expect.objectContaining({
        depth: 1,
        processChoices: ['Consumer'],
        diagnostic: { stackName: 'values' },
      }),
    )
    expect(engine.getState().stepCount).toBe(0)
  })

  it('explores priority queue contents as semantic state', () => {
    const engine = createEngine(`
      shared priority_queue<int> jobs = priority_queue[(1, 4)];

      process Consumer {
        int value = jobs.dequeue();
      }

      process Observer {
        bool untouched = true;
      }
    `)
    const property: ExplorationProperty<
      'PRIORITY_QUEUE_EMPTY',
      { readonly queueName: string }
    > = {
      kind: 'PRIORITY_QUEUE_EMPTY',
      evaluate(state) {
        const queue = state.program.sharedMemory.jobs

        return isPriorityQueueValue(queue)
          && queue.items.length === 0
          ? { queueName: 'jobs' }
          : undefined
      },
    }

    const result = exploreExecution(
      engine,
      { maxDepth: 3, maxStates: 10 },
      property,
    )

    expect(result.status).toBe('FOUND')
    expect(result.counterexample).toEqual(
      expect.objectContaining({
        depth: 1,
        processChoices: ['Consumer'],
        diagnostic: { queueName: 'jobs' },
      }),
    )
    expect(engine.getState().stepCount).toBe(0)
  })

  it('explores FIFO queue contents as semantic state', () => {
    const engine = createEngine(`
      shared queue<int> jobs = queue[1];

      process Consumer {
        int value = jobs.dequeue();
      }

      process Observer {
        bool untouched = true;
      }
    `)
    const property: ExplorationProperty<
      'QUEUE_EMPTY',
      { readonly queueName: string }
    > = {
      kind: 'QUEUE_EMPTY',
      evaluate(state) {
        const queue = state.program.sharedMemory.jobs

        return isQueueValue(queue)
          && queue.items.length === 0
          ? { queueName: 'jobs' }
          : undefined
      },
    }

    const result = exploreExecution(
      engine,
      {
        maxDepth: 3,
        maxStates: 10,
      },
      property,
    )

    expect(result.status).toBe('FOUND')
    expect(result.counterexample).toEqual(
      expect.objectContaining({
        depth: 1,
        processChoices: ['Consumer'],
        diagnostic: { queueName: 'jobs' },
      }),
    )
    expect(engine.getState().stepCount).toBe(0)
  })

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
