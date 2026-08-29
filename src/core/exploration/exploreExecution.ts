import type { SimulationEngine } from '../engine/SimulationEngine'
import { cloneExecutionState } from '../engine/cloneExecutionState'
import type { ExecutionState } from '../engine/ExecutionState'
import type { ProcessId } from '../process/ProcessId'
import type { ExplorationProperty } from './ExplorationProperty'
import type {
  ExplorationCounterexample,
  ExplorationLimits,
  ExplorationResult,
  ExplorationStatistics,
  ExplorationTruncationReason,
} from './ExplorationResult'
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

export function exploreExecution<
  Kind extends string,
  Diagnostic,
>(
  initialEngine: SimulationEngine,
  limits: ExplorationLimits,
  property: ExplorationProperty<Kind, Diagnostic>,
): ExplorationResult<Kind, Diagnostic> {
  validateLimits(limits)

  const createStateKey =
    property.createStateKey
    ?? createSemanticStateKey
  const initialStateKey = createStateKey(
    initialEngine.getState(),
  )
  const initialNode: ExplorationNode = {
    engine: initialEngine.fork(),
    depth: 0,
    processChoices: [],
  }
  const visited = new VisitedStateRegistry(
    createStateKey,
  )
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
      property,
      createStateKey,
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
        property,
        createStateKey,
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

function createCounterexample<
  Kind extends string,
  Diagnostic,
>(
  node: ExplorationNode,
  initialStateKey: string,
  limits: ExplorationLimits,
  property: ExplorationProperty<Kind, Diagnostic>,
  createStateKey: (state: ExecutionState) => string,
): ExplorationCounterexample<Kind, Diagnostic> | undefined {
  const diagnostic = property.evaluate(
    node.engine.getState(),
  )

  if (diagnostic === undefined) {
    return undefined
  }

  return {
    kind: property.kind,
    depth: node.depth,
    limits: { ...limits },
    processChoices: [...node.processChoices],
    initialStateKey,
    terminalStateKey: createStateKey(
      node.engine.getState(),
    ),
    terminalState: cloneExecutionState(
      node.engine.getState(),
    ),
    diagnostic: structuredClone(diagnostic),
  }
}

function createResult<
  Kind extends string,
  Diagnostic,
>(
  status: ExplorationResult<Kind, Diagnostic>['status'],
  limits: ExplorationLimits,
  statistics: MutableStatistics,
  truncationReasons:
    Set<ExplorationTruncationReason>,
  counterexample?: ExplorationCounterexample<
    Kind,
    Diagnostic
  >,
): ExplorationResult<Kind, Diagnostic> {
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
