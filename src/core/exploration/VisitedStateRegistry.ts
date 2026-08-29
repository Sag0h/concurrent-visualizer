import type { ExecutionState } from '../engine/ExecutionState'
import { createSemanticStateKey } from './createSemanticStateKey'

export type StateVisitResult =
  | 'NEW'
  | 'REPEATED'

export class VisitedStateRegistry {
  private readonly keys = new Set<string>()

  get size(): number {
    return this.keys.size
  }

  visit(state: ExecutionState): StateVisitResult {
    const key = createSemanticStateKey(state)

    if (this.keys.has(key)) {
      return 'REPEATED'
    }

    this.keys.add(key)

    return 'NEW'
  }

  has(state: ExecutionState): boolean {
    return this.keys.has(
      createSemanticStateKey(state),
    )
  }
}
