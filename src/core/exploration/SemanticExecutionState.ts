import type { ExecutionState } from '../engine/ExecutionState'
import type { Program } from '../engine/Program'

export interface SemanticExecutionState {
  readonly program: Program
}

export function projectSemanticExecutionState(
  state: ExecutionState,
): SemanticExecutionState {
  return {
    program: structuredClone(state.program),
  }
}
