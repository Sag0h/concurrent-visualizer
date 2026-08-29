import type { ExecutionState } from '../engine/ExecutionState'
import { createCanonicalValueKey } from './createSemanticStateKey'
import { projectExplorationAnalysisState } from './ExplorationAnalysisState'

export function createAnalyzedStateKey(
  state: ExecutionState,
): string {
  return createCanonicalValueKey({
    semanticState: state.program,
    analysisState:
      projectExplorationAnalysisState(state),
  })
}
