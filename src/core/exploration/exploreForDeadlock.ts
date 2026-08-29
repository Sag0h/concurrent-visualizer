import type { SimulationEngine } from '../engine/SimulationEngine'
import type { ProcessId } from '../process/ProcessId'
import { cloneExecutionState } from '../engine/cloneExecutionState'
import type {
  DeadlockCounterexample,
  DeadlockExplorationResult,
  ExplorationLimits,
  ExplorationStatistics,
  ExplorationTruncationReason,
} from './DeadlockExplorationResult'
import { createSemanticStateKey } from './createSemanticStateKey'
import { VisitedStateRegistry } from './VisitedStateRegistry'

interface ExplorationNode {
  readonly engine: SimulationEngine
  readonly depth: number
  readonly processChoices: ProcessId[]
}

interface MutableStatistics {
  visitedStateCount: number
  exploredTransitionCount: number
  maximumDepthReached: number
}

export function exploreForDeadlock(
  initialEngine: SimulationEngine,
  limits: ExplorationLimits,
): DeadlockExplorationResult {
  validateLimits(limits)

  const initialStateKey = createSemanticStateKey(
    initialEngine.getState(),
  )
  const initialNode: ExplorationNode = {
    engine: initialEngine.fork(),
    depth: 0,
    processChoices: [],
  }
  const visited = new VisitedStateRegistry()
  const statistics: MutableStatistics = {
    visitedStateCount: 1,
    exploredTransitionCount: 0,
    maximumDepthReached: 0,
  }
  const truncationReasons =
    new Set<ExplorationTruncationReason>()
  const queue: ExplorationNode[] = [initialNode]
  let queueIndex = 0

  visited.visit(initialNode.engine.getState())

  while (queueIndex < queue.length) {
    const node = queue[queueIndex]
    queueIndex++

    const counterexample = createCounterexample(
      node,
      initialStateKey,
      limits,
    )

    if (counterexample) {
      return createResult(
        'FOUND',
        limits,
        statistics,
        truncationReasons,
        counterexample,
      )
    }

    if (node.engine.hasReachedStepLimit()) {
      if (!node.engine.isFinished()) {
        truncationReasons.add(
          'ENGINE_STEP_LIMIT',
        )
      }

      continue
    }

    const transitions =
      node.engine.getEnabledTransitions()

    if (node.depth >= limits.maxDepth) {
      if (transitions.length > 0) {
        truncationReasons.add('MAX_DEPTH')
      }

      continue
    }

    for (const transition of transitions) {
      const childEngine = node.engine.fork()

      childEngine.stepTransition(transition)
      statistics.exploredTransitionCount++

      const childDepth = node.depth + 1
      statistics.maximumDepthReached = Math.max(
        statistics.maximumDepthReached,
        childDepth,
      )

      if (visited.has(childEngine.getState())) {
        continue
      }

      if (visited.size >= limits.maxStates) {
        truncationReasons.add('MAX_STATES')

        return createResult(
          'TRUNCATED',
          limits,
          statistics,
          truncationReasons,
        )
      }

      visited.visit(childEngine.getState())
      statistics.visitedStateCount =
        visited.size

      const childNode: ExplorationNode = {
        engine: childEngine,
        depth: childDepth,
        processChoices: [
          ...node.processChoices,
          transition.processId,
        ],
      }
      const counterexample = createCounterexample(
        childNode,
        initialStateKey,
        limits,
      )

      if (counterexample) {
        return createResult(
          'FOUND',
          limits,
          statistics,
          truncationReasons,
          counterexample,
        )
      }

      queue.push(childNode)
    }
  }

  return createResult(
    truncationReasons.size > 0
      ? 'TRUNCATED'
      : 'EXHAUSTED',
    limits,
    statistics,
    truncationReasons,
  )
}

function createCounterexample(
  node: ExplorationNode,
  initialStateKey: string,
  limits: ExplorationLimits,
): DeadlockCounterexample | undefined {
  if (!node.engine.isDeadlocked()) {
    return undefined
  }

  const snapshot = node.engine.getSnapshot()

  if (!snapshot.deadlock) {
    throw new Error(
      'Deadlocked engine did not expose its diagnostic',
    )
  }

  return {
    kind: 'DEADLOCK',
    depth: node.depth,
    limits: { ...limits },
    processChoices: [...node.processChoices],
    initialStateKey,
    terminalStateKey: createSemanticStateKey(
      node.engine.getState(),
    ),
    terminalState: cloneExecutionState(
      node.engine.getState(),
    ),
    diagnostic: structuredClone(snapshot.deadlock),
  }
}

function createResult(
  status: DeadlockExplorationResult['status'],
  limits: ExplorationLimits,
  statistics: MutableStatistics,
  truncationReasons:
    Set<ExplorationTruncationReason>,
  counterexample?: DeadlockCounterexample,
): DeadlockExplorationResult {
  return {
    status,
    limits: { ...limits },
    statistics: {
      ...statistics,
    } satisfies ExplorationStatistics,
    truncationReasons: [
      ...truncationReasons,
    ],
    counterexample,
  }
}

function validateLimits(
  limits: ExplorationLimits,
): void {
  if (
    !Number.isInteger(limits.maxDepth)
    || limits.maxDepth < 0
  ) {
    throw new Error(
      'Exploration maxDepth must be a non-negative integer',
    )
  }

  if (
    !Number.isInteger(limits.maxStates)
    || limits.maxStates < 1
  ) {
    throw new Error(
      'Exploration maxStates must be a positive integer',
    )
  }
}
