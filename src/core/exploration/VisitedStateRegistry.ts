import type { ExecutionState } from '../engine/ExecutionState'
import { createSemanticStateKey } from './createSemanticStateKey'

export type ExecutionStateKeyFactory = (
  state: ExecutionState,
) => string

export type StateVisitResult =
  | 'NEW'
  | 'REPEATED'

export class VisitedStateRegistry {
  private readonly keys = new Set<string>()
  private readonly createStateKey:
    ExecutionStateKeyFactory

  constructor(
    createStateKey:
      ExecutionStateKeyFactory = createSemanticStateKey,
  ) {
    this.createStateKey = createStateKey
  }

  get size(): number {
    return this.keys.size
  }

  visit(state: ExecutionState): StateVisitResult {
    const key = this.createStateKey(state)

    if (this.keys.has(key)) {
      return 'REPEATED'
    }

    this.keys.add(key)

    return 'NEW'
  }

  has(state: ExecutionState): boolean {
    return this.keys.has(
      this.createStateKey(state),
    )
  }
}
