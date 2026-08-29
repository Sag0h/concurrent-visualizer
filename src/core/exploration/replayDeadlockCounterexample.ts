import type { SimulationEngine } from '../engine/SimulationEngine'
import type { DeadlockCounterexample } from './DeadlockExplorationResult'
import { createSemanticStateKey } from './createSemanticStateKey'

export function replayDeadlockCounterexample(
  initialEngine: SimulationEngine,
  counterexample: DeadlockCounterexample,
): SimulationEngine {
  const initialStateKey = createSemanticStateKey(
    initialEngine.getState(),
  )

  if (initialStateKey !== counterexample.initialStateKey) {
    throw new Error(
      'Counterexample does not start from the supplied engine state',
    )
  }

  const replayEngine = initialEngine.fork()

  counterexample.processChoices.forEach(
    (processId, index) => {
      const transition = replayEngine
        .getEnabledTransitions()
        .find(
          (candidate) =>
            candidate.processId === processId,
        )

      if (!transition) {
        throw new Error(
          `Counterexample choice ${index + 1} for process "${processId}" is not enabled`,
        )
      }

      replayEngine.stepTransition(transition)
    },
  )

  if (
    !replayEngine.isDeadlocked()
    || createSemanticStateKey(
      replayEngine.getState(),
    ) !== counterexample.terminalStateKey
  ) {
    throw new Error(
      'Counterexample replay did not reach the recorded deadlock state',
    )
  }

  return replayEngine
}
