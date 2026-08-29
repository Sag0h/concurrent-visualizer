import type { DeadlockDiagnostic } from '../deadlock/DeadlockDiagnostic'
import type {
  ExplorationCounterexample,
  ExplorationResult,
} from './ExplorationResult'

export type {
  ExplorationLimits,
  ExplorationStatistics,
  ExplorationStatus,
  ExplorationTruncationReason,
} from './ExplorationResult'

export type DeadlockCounterexample =
  ExplorationCounterexample<
    'DEADLOCK',
    DeadlockDiagnostic
  >

export type DeadlockExplorationResult =
  ExplorationResult<
    'DEADLOCK',
    DeadlockDiagnostic
  >
