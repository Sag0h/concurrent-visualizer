import { reconstructExecutionAnalysisState } from '../engine/ExecutionAnalysisState'
import type { ExecutionState } from '../engine/ExecutionState'
import { findMemoryAccessConflicts } from '../engine/findMemoryAccessConflicts'
import type { MemoryAccessConflict } from '../engine/MemoryAccessConflict'
import { createAnalyzedStateKey } from './createAnalyzedStateKey'
import type { ExplorationProperty } from './ExplorationProperty'
import type { MutualExclusionViolationDiagnostic } from './MutualExclusionViolationExplorationResult'

export const mutualExclusionViolationProperty:
  ExplorationProperty<
    'MUTUAL_EXCLUSION_VIOLATION',
    MutualExclusionViolationDiagnostic
  > = {
    kind: 'MUTUAL_EXCLUSION_VIOLATION',
    evaluate: findObservedMutualExclusionViolation,
    createStateKey: createAnalyzedStateKey,
  }

function findObservedMutualExclusionViolation(
  state: ExecutionState,
): MutualExclusionViolationDiagnostic | undefined {
  const memoryAnalysis = (
    state.analysisState
    ?? reconstructExecutionAnalysisState(state)
  ).memory

  return findMemoryAccessConflicts(
    memoryAnalysis.memoryAccessEvents,
    {
      executionHistory:
        memoryAnalysis.semaphoreEvents,
      initialSemaphoreValues:
        memoryAnalysis.initialSemaphoreValues,
    },
  ).find(isObservedMutualExclusionViolation)
}

function isObservedMutualExclusionViolation(
  conflict: MemoryAccessConflict,
): conflict is MutualExclusionViolationDiagnostic {
  return (
    conflict.diagnostic
      === 'MUTUAL_EXCLUSION_VIOLATION'
    && conflict.reason.type
      === 'OBSERVED_MUTEX_OVERLAP'
  )
}
