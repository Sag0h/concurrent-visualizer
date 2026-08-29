import type { Program } from './Program'
import type { ExecutionEvent } from './ExecutionEvent'
import type { MicroOperationEvent } from './MicroOperationEvent'
import type { ExecutionAnalysisState } from './ExecutionAnalysisState'

export interface ExecutionState {
  program: Program
  stepCount: number
  history: ExecutionEvent[]
  microOperationHistory?: MicroOperationEvent[]
  analysisState?: ExecutionAnalysisState
}
