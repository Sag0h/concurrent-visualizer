import type { SimulationEngine } from '../engine/SimulationEngine'
import type { DeadlockCounterexample } from './DeadlockExplorationResult'
import { deadlockExplorationProperty } from './deadlockExplorationProperty'
import { replayCounterexample } from './replayCounterexample'

export function replayDeadlockCounterexample(
  initialEngine: SimulationEngine,
  counterexample: DeadlockCounterexample,
): SimulationEngine {
  return replayCounterexample(
    initialEngine,
    counterexample,
    deadlockExplorationProperty,
  )
}
