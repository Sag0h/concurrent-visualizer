import type { SimulationEngine } from '../engine/SimulationEngine'
import type { ExplorationProperty } from './ExplorationProperty'
import type { ExplorationCounterexample } from './ExplorationResult'
import { createSemanticStateKey } from './createSemanticStateKey'

export function replayCounterexample<
  Kind extends string,
  Diagnostic,
>(
  initialEngine: SimulationEngine,
  counterexample: ExplorationCounterexample<
    Kind,
    Diagnostic
  >,
  property: ExplorationProperty<Kind, Diagnostic>,
): SimulationEngine {
  const createStateKey =
    property.createStateKey
    ?? createSemanticStateKey
  const initialStateKey = createStateKey(
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
    property.evaluate(replayEngine.getState())
      === undefined
    || createStateKey(replayEngine.getState())
      !== counterexample.terminalStateKey
  ) {
    throw new Error(
      `Counterexample replay did not reach the recorded ${property.kind} state`,
    )
  }

  return replayEngine
}
