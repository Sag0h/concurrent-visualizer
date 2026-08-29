import type { ExecutionState } from '../engine/ExecutionState'

export interface ExplorationProperty<
  Kind extends string,
  Diagnostic,
> {
  readonly kind: Kind
  /** Evaluates without mutating the supplied execution state. */
  readonly evaluate: (
    state: ExecutionState,
  ) => Diagnostic | undefined
  /**
   * Extends semantic identity when this property depends on additional
   * analysis information already represented by ExecutionState.
   */
  readonly createStateKey?: (
    state: ExecutionState,
  ) => string
}
