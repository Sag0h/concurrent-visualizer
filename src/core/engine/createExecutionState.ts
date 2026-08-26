import type { Program } from './Program'
import type { ExecutionState } from './ExecutionState'

export function createExecutionState(
  program: Program,
): ExecutionState {
  return {
    program,
    stepCount: 0,
    history: [],
  }
}
