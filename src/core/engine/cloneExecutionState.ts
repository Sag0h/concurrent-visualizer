import type { ExecutionState } from './ExecutionState'

export function cloneExecutionState(
  state: ExecutionState,
): ExecutionState {
  return structuredClone(state)
}
