import { evaluateExpression } from '../expressions/evaluateExpression'
import type { ExecutionEvent } from '../engine/ExecutionEvent'
import type { ExecutionState } from '../engine/ExecutionState'
import type { Process } from '../process/Process'
import type { ProcessId } from '../process/ProcessId'
import type {
  DeadlockCycle,
  ExecutionDiagnostic,
  ResourceDependency,
  WaitForEdge,
  WaitForResource,
} from './DeadlockDiagnostic'

const semaphoreResourcePrefix = 'SEMAPHORE:'

export function analyzeDeadlock(
  state: ExecutionState,
): ExecutionDiagnostic {
  const processes = state.program.processes

  if (
    processes.every(
      (process) => process.state === 'FINISHED',
    )
  ) {
    return {
      status: 'FINISHED',
    }
  }

  const blockedProcesses = processes.filter(
    (process) => process.state === 'BLOCKED',
  )
  const directlyExecutableProcesses = processes.filter(
    (process) =>
      process.state === 'READY'
      || process.state === 'RUNNING',
  )
  const enabledBlockedProcesses = blockedProcesses.filter(
    (process) =>
      isBlockedProcessCurrentlyEnabled(
        process,
        state,
      ),
  )

  if (
    directlyExecutableProcesses.length > 0
    || enabledBlockedProcesses.length > 0
  ) {
    return {
      status:
        blockedProcesses.length > 0
          ? 'TEMPORARILY_BLOCKED'
          : 'RUNNING',
    }
  }

  if (blockedProcesses.length === 0) {
    return {
      status: 'RUNNING',
    }
  }

  return {
    status: 'DEADLOCK',
    deadlock: buildDeadlockDiagnostic(
      state,
      blockedProcesses,
    ),
  }
}

function isBlockedProcessCurrentlyEnabled(
  process: Process,
  state: ExecutionState,
): boolean {
  const reason = process.blockingReason

  if (!reason) {
    return false
  }

  switch (reason.type) {
    case 'SEMAPHORE_P':
      return (
        state.program.semaphores?.[
          reason.semaphoreName
        ]?.value ?? 0
      ) > 0

    case 'AWAIT': {
      const functionFrame =
        process.callStack[
          process.callStack.length - 1
        ]

      return evaluateExpression(
        reason.condition,
        {
          localMemory:
            functionFrame?.localMemory
            ?? process.localMemory,
          sharedMemory:
            state.program.sharedMemory,
        },
      ) === true
    }
  }
}

function buildDeadlockDiagnostic(
  state: ExecutionState,
  blockedProcesses: Process[],
) {
  const outstandingPermits =
    inferOutstandingPermits(state.history)
  const resources = new Map<string, WaitForResource>()
  const resourceDependencies: ResourceDependency[] = []
  const waitForEdges: WaitForEdge[] = []
  let graphIsComplete = true

  for (const process of blockedProcesses) {
    const reason = process.blockingReason

    if (reason?.type !== 'SEMAPHORE_P') {
      graphIsComplete = false
      continue
    }

    const resource = semaphoreResource(
      reason.semaphoreName,
    )
    resources.set(resource.id, resource)
    resourceDependencies.push({
      type: 'WAITS_FOR',
      processId: process.id,
      resourceId: resource.id,
    })

    const holders = outstandingPermits.get(
      reason.semaphoreName,
    ) ?? []

    if (holders.length === 0) {
      graphIsComplete = false
    }

    for (const holderId of new Set(holders)) {
      resourceDependencies.push({
        type: 'HOLDS',
        processId: holderId,
        resourceId: resource.id,
      })
      waitForEdges.push({
        waitingProcessId: process.id,
        holdingProcessId: holderId,
        resourceId: resource.id,
      })
    }
  }

  const uniqueDependencies = deduplicateDependencies(
    resourceDependencies,
  )
  const uniqueWaitForEdges = deduplicateWaitForEdges(
    waitForEdges,
  )
  const cycles = findDeadlockCycles(
    uniqueWaitForEdges,
  )
  const cycleProcessIds = sortedUnique(
    cycles.flatMap(
      (cycle) => cycle.processIds,
    ),
  )
  const involvedProcessIds = sortedUnique(
    blockedProcesses.map(
      (process) => process.id,
    ),
  )
  const involvedResourceIds = new Set(
    uniqueDependencies
      .filter(
        (dependency) =>
          dependency.type === 'WAITS_FOR',
      )
      .map(
        (dependency) => dependency.resourceId,
      ),
  )
  const involvedResources = [...resources.values()]
    .filter(
      (resource) => involvedResourceIds.has(resource.id),
    )
    .sort(
      (first, second) =>
        first.name.localeCompare(second.name),
    )
  const hasCircularWait = cycles.length > 0

  return {
    kind: hasCircularWait
      ? 'CIRCULAR_WAIT' as const
      : 'TERMINAL_BLOCKING' as const,
    detectedAtStep: state.stepCount,
    summary: hasCircularWait
      ? `Circular wait detected among ${cycleProcessIds.length} processes.`
      : 'No process can advance. A circular wait could not be proven with the available resource information.',
    blockedProcessIds: blockedProcesses.map(
      (process) => process.id,
    ),
    involvedProcessIds,
    involvedResources,
    resourceDependencies: uniqueDependencies,
    waitForEdges: uniqueWaitForEdges,
    cycles,
    graphIsComplete,
    replayTargetStep: state.stepCount,
  }
}

function inferOutstandingPermits(
  history: ExecutionEvent[],
): Map<string, ProcessId[]> {
  const outstandingPermits =
    new Map<string, ProcessId[]>()

  for (const event of history) {
    const semaphoreEvent = event.semaphoreEvent

    if (
      !semaphoreEvent
      || semaphoreEvent.status !== 'SUCCEEDED'
    ) {
      continue
    }

    const permits = outstandingPermits.get(
      semaphoreEvent.semaphoreName,
    ) ?? []

    if (semaphoreEvent.operation === 'P') {
      permits.push(event.processId)
      outstandingPermits.set(
        semaphoreEvent.semaphoreName,
        permits,
      )
      continue
    }

    const ownPermitIndex = permits.lastIndexOf(
      event.processId,
    )

    if (ownPermitIndex >= 0) {
      permits.splice(ownPermitIndex, 1)
    } else {
      permits.shift()
    }

    outstandingPermits.set(
      semaphoreEvent.semaphoreName,
      permits,
    )
  }

  return outstandingPermits
}

function semaphoreResource(
  semaphoreName: string,
): WaitForResource {
  return {
    id: `${semaphoreResourcePrefix}${semaphoreName}`,
    kind: 'SEMAPHORE',
    name: semaphoreName,
  }
}

function deduplicateDependencies(
  dependencies: ResourceDependency[],
): ResourceDependency[] {
  return deduplicateBy(
    dependencies,
    (dependency) =>
      `${dependency.type}:${dependency.processId}:${dependency.resourceId}`,
  )
}

function deduplicateWaitForEdges(
  edges: WaitForEdge[],
): WaitForEdge[] {
  return deduplicateBy(
    edges,
    (edge) =>
      `${edge.waitingProcessId}:${edge.holdingProcessId}:${edge.resourceId}`,
  )
}

function deduplicateBy<T>(
  values: T[],
  keyFor: (value: T) => string,
): T[] {
  const seen = new Set<string>()

  return values.filter((value) => {
    const key = keyFor(value)

    if (seen.has(key)) {
      return false
    }

    seen.add(key)
    return true
  })
}

function findDeadlockCycles(
  edges: WaitForEdge[],
): DeadlockCycle[] {
  const processIds = sortedUnique(
    edges.flatMap((edge) => [
      edge.waitingProcessId,
      edge.holdingProcessId,
    ]),
  )
  const adjacency = new Map<ProcessId, ProcessId[]>()

  for (const processId of processIds) {
    adjacency.set(processId, [])
  }

  for (const edge of edges) {
    adjacency.get(edge.waitingProcessId)?.push(
      edge.holdingProcessId,
    )
  }

  const components = stronglyConnectedComponents(
    processIds,
    adjacency,
  )

  return components
    .filter((component) => {
      if (component.length > 1) {
        return true
      }

      const [processId] = component
      return adjacency.get(processId)?.includes(
        processId,
      ) ?? false
    })
    .map((component) => {
      const members = new Set(component)
      const resourceIds = sortedUnique(
        edges
          .filter(
            (edge) =>
              members.has(edge.waitingProcessId)
              && members.has(edge.holdingProcessId),
          )
          .map((edge) => edge.resourceId),
      )

      return {
        processIds: [...component].sort(),
        resourceIds,
      }
    })
}

function stronglyConnectedComponents(
  processIds: ProcessId[],
  adjacency: Map<ProcessId, ProcessId[]>,
): ProcessId[][] {
  let nextIndex = 0
  const indices = new Map<ProcessId, number>()
  const lowLinks = new Map<ProcessId, number>()
  const stack: ProcessId[] = []
  const onStack = new Set<ProcessId>()
  const components: ProcessId[][] = []

  function visit(processId: ProcessId): void {
    indices.set(processId, nextIndex)
    lowLinks.set(processId, nextIndex)
    nextIndex += 1
    stack.push(processId)
    onStack.add(processId)

    for (const neighbor of adjacency.get(processId) ?? []) {
      if (!indices.has(neighbor)) {
        visit(neighbor)
        lowLinks.set(
          processId,
          Math.min(
            lowLinks.get(processId) ?? 0,
            lowLinks.get(neighbor) ?? 0,
          ),
        )
      } else if (onStack.has(neighbor)) {
        lowLinks.set(
          processId,
          Math.min(
            lowLinks.get(processId) ?? 0,
            indices.get(neighbor) ?? 0,
          ),
        )
      }
    }

    if (
      lowLinks.get(processId)
      !== indices.get(processId)
    ) {
      return
    }

    const component: ProcessId[] = []
    let member: ProcessId | undefined

    do {
      member = stack.pop()

      if (member !== undefined) {
        onStack.delete(member)
        component.push(member)
      }
    } while (member !== processId)

    components.push(component)
  }

  for (const processId of processIds) {
    if (!indices.has(processId)) {
      visit(processId)
    }
  }

  return components
}

function sortedUnique<T extends string>(
  values: T[],
): T[] {
  return [...new Set(values)].sort()
}
