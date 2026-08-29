import {
  reconstructExecutionAnalysisState,
  type ExecutionAnalysisState,
} from '../engine/ExecutionAnalysisState'
import type { ExecutionState } from '../engine/ExecutionState'

export type ExplorationAnalysisState =
  ExecutionAnalysisState

export function projectExplorationAnalysisState(
  state: ExecutionState,
): ExplorationAnalysisState {
  return structuredClone(
    state.analysisState
    ?? reconstructExecutionAnalysisState(state),
  )
}
