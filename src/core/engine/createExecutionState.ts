import type { Program } from './Program'
import type { ExecutionState } from './ExecutionState'
import { createInitialExecutionAnalysisState } from './ExecutionAnalysisState'
import { evaluateExpression } from '../expressions/evaluateExpression'
import type { MonitorRuntimeState } from '../monitors/MonitorRuntimeState'
import type { ChannelRuntimeState } from '../channels/ChannelRuntimeState'

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
    channelStates: createChannelStates(program),
  }
}

function createChannelStates(
  program: Program,
): Record<string, ChannelRuntimeState> {
  const states: Record<string, ChannelRuntimeState> = {}

  for (const definition of Object.values(program.channels ?? {})) {
    if (definition.arrayLength === undefined) {
      states[definition.name] = { messages: [] }
      continue
    }

    for (let index = 0; index < definition.arrayLength; index++) {
      states[`${definition.name}[${index}]`] = { messages: [] }
    }
  }

  return states
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
