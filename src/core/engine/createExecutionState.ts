import type { Program } from './Program'
import type { ExecutionState } from './ExecutionState'
import { createInitialExecutionAnalysisState } from './ExecutionAnalysisState'

export function createExecutionState(
  program: Program,
): ExecutionState {
  return {
    program,
    stepCount: 0,
    history: [],
    analysisState:
      createInitialExecutionAnalysisState(program),
  }
}
