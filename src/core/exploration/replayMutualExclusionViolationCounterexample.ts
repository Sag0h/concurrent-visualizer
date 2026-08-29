import type { SimulationEngine } from '../engine/SimulationEngine'
import type { MutualExclusionViolationCounterexample } from './MutualExclusionViolationExplorationResult'
import { mutualExclusionViolationProperty } from './mutualExclusionViolationProperty'
import { replayCounterexample } from './replayCounterexample'

export function replayMutualExclusionViolationCounterexample(
  initialEngine: SimulationEngine,
  counterexample:
    MutualExclusionViolationCounterexample,
): SimulationEngine {
  return replayCounterexample(
    initialEngine,
    counterexample,
    mutualExclusionViolationProperty,
  )
}
