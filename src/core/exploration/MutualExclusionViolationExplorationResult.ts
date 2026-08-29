import type { MemoryAccessConflict } from '../engine/MemoryAccessConflict'
import type { MemoryConflictReason } from '../engine/MemoryConflictReason'
import type {
  ExplorationCounterexample,
  ExplorationResult,
} from './ExplorationResult'

export type MutualExclusionViolationDiagnostic =
  MemoryAccessConflict & {
    readonly diagnostic:
      'MUTUAL_EXCLUSION_VIOLATION'
    readonly reason: Extract<
      MemoryConflictReason,
      { readonly type: 'OBSERVED_MUTEX_OVERLAP' }
    >
  }

export type MutualExclusionViolationCounterexample =
  ExplorationCounterexample<
    'MUTUAL_EXCLUSION_VIOLATION',
    MutualExclusionViolationDiagnostic
  >

export type MutualExclusionViolationExplorationResult =
  ExplorationResult<
    'MUTUAL_EXCLUSION_VIOLATION',
    MutualExclusionViolationDiagnostic
  >
