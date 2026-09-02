import type { Program } from './Program'
import type { ExecutionEvent } from './ExecutionEvent'
import type { MicroOperationEvent } from './MicroOperationEvent'
import type { ExecutionAnalysisState } from './ExecutionAnalysisState'
import type { MonitorRuntimeState } from '../monitors/MonitorRuntimeState'

export interface ExecutionState {
  program: Program
  stepCount: number
  history: ExecutionEvent[]
  microOperationHistory?: MicroOperationEvent[]
  analysisState?: ExecutionAnalysisState
  monitorStates?: Record<string, MonitorRuntimeState>
}
