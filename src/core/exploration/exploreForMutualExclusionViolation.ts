import type { SimulationEngine } from '../engine/SimulationEngine'
import type { ExplorationLimits } from './ExplorationResult'
import type { MutualExclusionViolationExplorationResult } from './MutualExclusionViolationExplorationResult'
import { exploreExecution } from './exploreExecution'
import { mutualExclusionViolationProperty } from './mutualExclusionViolationProperty'

export function exploreForMutualExclusionViolation(
  initialEngine: SimulationEngine,
  limits: ExplorationLimits,
): MutualExclusionViolationExplorationResult {
  return exploreExecution(
    initialEngine,
    limits,
    mutualExclusionViolationProperty,
  )
}
