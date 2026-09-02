import type { ExecutionState } from '../engine/ExecutionState'
import type { Program } from '../engine/Program'
import type { MonitorRuntimeState } from '../monitors/MonitorRuntimeState'

export interface SemanticExecutionState {
  readonly program: Program
  readonly monitorStates: Record<string, MonitorRuntimeState>
}

export function projectSemanticExecutionState(
  state: ExecutionState,
): SemanticExecutionState {
  return {
    program: structuredClone(state.program),
    monitorStates: structuredClone(state.monitorStates ?? {}),
  }
}
