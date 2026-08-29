import type { ExecutionState } from '../engine/ExecutionState'
import type { ProcessId } from '../process/ProcessId'

export type ExplorationStatus =
  | 'FOUND'
  | 'EXHAUSTED'
  | 'TRUNCATED'

export type ExplorationTruncationReason =
  | 'MAX_DEPTH'
  | 'MAX_STATES'
  | 'ENGINE_STEP_LIMIT'

export interface ExplorationLimits {
  readonly maxDepth: number
  readonly maxStates: number
}

export interface ExplorationStatistics {
  readonly visitedStateCount: number
  readonly exploredTransitionCount: number
  readonly maximumDepthReached: number
}

export interface ExplorationCounterexample<
  Kind extends string,
  Diagnostic,
> {
  readonly kind: Kind
  readonly depth: number
  readonly limits: ExplorationLimits
  readonly processChoices: ProcessId[]
  readonly initialStateKey: string
  readonly terminalStateKey: string
  readonly terminalState: ExecutionState
  readonly diagnostic: Diagnostic
}

export interface ExplorationResult<
  Kind extends string,
  Diagnostic,
> {
  readonly status: ExplorationStatus
  readonly limits: ExplorationLimits
  readonly statistics: ExplorationStatistics
  readonly truncationReasons: ExplorationTruncationReason[]
  readonly counterexample?: ExplorationCounterexample<
    Kind,
    Diagnostic
  >
}
