import type { Program } from './Program'
import type { ExecutionState } from './ExecutionState'
import { createInitialExecutionAnalysisState } from './ExecutionAnalysisState'
import { evaluateExpression } from '../expressions/evaluateExpression'
import type { MonitorRuntimeState } from '../monitors/MonitorRuntimeState'

export function createExecutionState(
  program: Program,
): ExecutionState {
  return {
    program,
    stepCount: 0,
    history: [],
    analysisState:
      createInitialExecutionAnalysisState(program),
    monitorStates: createMonitorStates(program),
  }
}

function createMonitorStates(
  program: Program,
): Record<string, MonitorRuntimeState> {
  return Object.fromEntries(
    Object.values(program.monitors ?? {}).map(
      (definition) => {
        const memory: MonitorRuntimeState['memory'] = {}

        for (const state of definition.state) {
          memory[state.name] = structuredClone(
            evaluateExpression(state.initialValue, {
              localMemory: memory,
              sharedMemory: program.sharedMemory,
            }),
          )
        }

        return [definition.name, {
          definitionName: definition.name,
          memory,
          initialized: true,
          entryContenderProcessIds: [],
          conditions: Object.fromEntries(
            definition.conditions.map(
              (condition) => [condition.name, {
                waitingProcessIds: [],
              }],
            ),
          ),
        }]
      },
    ),
  )
}
