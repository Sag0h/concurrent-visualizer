import type { SimulationEngine } from '../engine/SimulationEngine'
import type {
  DeadlockExplorationResult,
  ExplorationLimits,
} from './DeadlockExplorationResult'
import { deadlockExplorationProperty } from './deadlockExplorationProperty'
import { exploreExecution } from './exploreExecution'

export function exploreForDeadlock(
  initialEngine: SimulationEngine,
  limits: ExplorationLimits,
): DeadlockExplorationResult {
  return exploreExecution(
    initialEngine,
    limits,
    deadlockExplorationProperty,
  )
}
