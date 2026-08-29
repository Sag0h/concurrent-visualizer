import type { ExecutionEvent } from '../engine/ExecutionEvent'
import type { ExecutionState } from '../engine/ExecutionState'
import type { MicroOperationEvent } from '../engine/MicroOperationEvent'

export interface ExecutionTrace {
  readonly stepCount: number
  readonly executionEvents: ExecutionEvent[]
  readonly microOperationEvents: MicroOperationEvent[]
}

export function projectExecutionTrace(
  state: ExecutionState,
): ExecutionTrace {
  return {
    stepCount: state.stepCount,
    executionEvents:
      structuredClone(state.history),
    microOperationEvents:
      structuredClone(
        state.microOperationHistory ?? [],
      ),
  }
}
