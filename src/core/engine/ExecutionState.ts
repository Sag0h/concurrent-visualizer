import type { Program } from './Program'
import type { ExecutionEvent } from './ExecutionEvent'
import type { MicroOperationEvent } from './MicroOperationEvent'

export interface ExecutionState {
  program: Program
  stepCount: number
  history: ExecutionEvent[]
  microOperationHistory?: MicroOperationEvent[]
}
