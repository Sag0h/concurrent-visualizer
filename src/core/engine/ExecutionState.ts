import type { Program } from './Program'
import type { ExecutionEvent } from './ExecutionEvent'

export interface ExecutionState {
  program: Program
  stepCount: number
  history: ExecutionEvent[]
}
