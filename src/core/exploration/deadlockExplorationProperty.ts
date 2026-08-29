import { analyzeDeadlock } from '../deadlock/analyzeDeadlock'
import type { DeadlockDiagnostic } from '../deadlock/DeadlockDiagnostic'
import type { ExplorationProperty } from './ExplorationProperty'

export const deadlockExplorationProperty:
  ExplorationProperty<
    'DEADLOCK',
    DeadlockDiagnostic
  > = {
    kind: 'DEADLOCK',
    evaluate(state) {
      const result = analyzeDeadlock(state)

      return result.status === 'DEADLOCK'
        ? result.deadlock
        : undefined
    },
  }
