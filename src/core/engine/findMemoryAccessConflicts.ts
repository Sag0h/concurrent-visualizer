import type { MicroOperationEvent } from './MicroOperationEvent'
import type { MemoryAccessConflict } from './MemoryAccessConflict'
import type { ExecutionEvent } from './ExecutionEvent'
import type { ProcessId } from '../process/ProcessId'
import { sameMemoryLocation } from '../memory/MemoryLocationUtils'

export interface MemoryAccessAnalysisContext {
  readonly executionHistory:
    readonly ExecutionEvent[]
  readonly initialSemaphoreValues:
    Readonly<Record<string, number>>
}

interface SemaphoreAnalysis {
  readonly activeSections:
    ReadonlyMap<MicroOperationEvent, ReadonlySet<string>>
  readonly validMutexes: ReadonlySet<string>
  readonly directSignals: readonly DirectSemaphoreSignal[]
}

interface DirectSemaphoreSignal {
  readonly semaphoreName: string
  readonly sourceProcessId: ProcessId
  readonly targetProcessId: ProcessId
  readonly releaseStep: number
  readonly acquireStep: number
}

interface SignalingCandidate {
  isValid: boolean
  pendingSignal?: {
    readonly processId: ProcessId
    readonly step: number
  }
  readonly signals: DirectSemaphoreSignal[]
}

function isMemoryAccess(
  event: MicroOperationEvent,
): boolean {
  return (
    event.type === 'SHARED_READ'
    || event.type === 'SHARED_WRITE'
  )
}

function includesWrite(
  first: MicroOperationEvent,
  second: MicroOperationEvent,
): boolean {
  return (
    first.type === 'SHARED_WRITE'
    || second.type === 'SHARED_WRITE'
  )
}

function analyzeSemaphoreSections(
  events: readonly MicroOperationEvent[],
  context: MemoryAccessAnalysisContext,
): SemaphoreAnalysis {
  const validMutexes = new Map<string, boolean>()
  const mutexHolders = new Map<string, ProcessId>()

  for (
    const [name, initialValue]
    of Object.entries(
      context.initialSemaphoreValues,
    )
  ) {
    validMutexes.set(name, initialValue === 1)
  }

  for (const event of context.executionHistory) {
    const semaphoreEvent = event.semaphoreEvent

    if (
      !semaphoreEvent
      || semaphoreEvent.status !== 'SUCCEEDED'
    ) {
      continue
    }

    const name = semaphoreEvent.semaphoreName
    const holder = mutexHolders.get(name)

    if (semaphoreEvent.operation === 'P') {
      const followsMutexTransition =
        semaphoreEvent.valueBefore === 1
        && semaphoreEvent.valueAfter === 0
        && holder === undefined

      if (!followsMutexTransition) {
        validMutexes.set(name, false)
      } else {
        mutexHolders.set(name, event.processId)
      }

      continue
    }

    const followsMutexTransition =
      semaphoreEvent.valueBefore === 0
      && semaphoreEvent.valueAfter === 1
      && holder === event.processId

    if (!followsMutexTransition) {
      validMutexes.set(name, false)
    }

    if (holder === event.processId) {
      mutexHolders.delete(name)
    }
  }

  const activeByProcess = new Map<
    ProcessId,
    Map<string, number>
  >()

  const activeSections = new Map<
    MicroOperationEvent,
    ReadonlySet<string>
  >()

  const signalingCandidates = new Map<
    string,
    SignalingCandidate
  >()

  for (
    const [name, initialValue]
    of Object.entries(
      context.initialSemaphoreValues,
    )
  ) {
    if (initialValue === 0) {
      signalingCandidates.set(name, {
        isValid: true,
        signals: [],
      })
    }
  }

  for (const event of context.executionHistory) {
    const semaphoreEvent = event.semaphoreEvent

    if (
      !semaphoreEvent
      || semaphoreEvent.status !== 'SUCCEEDED'
    ) {
      continue
    }

    const candidate = signalingCandidates.get(
      semaphoreEvent.semaphoreName,
    )

    if (!candidate || !candidate.isValid) {
      continue
    }

    if (semaphoreEvent.operation === 'V') {
      if (
        semaphoreEvent.valueBefore !== 0
        || semaphoreEvent.valueAfter !== 1
        || candidate.pendingSignal
      ) {
        candidate.isValid = false
        continue
      }

      candidate.pendingSignal = {
        processId: event.processId,
        step: event.step,
      }
      continue
    }

    if (
      semaphoreEvent.valueBefore !== 1
      || semaphoreEvent.valueAfter !== 0
      || !candidate.pendingSignal
    ) {
      candidate.isValid = false
      continue
    }

    candidate.signals.push({
      semaphoreName:
        semaphoreEvent.semaphoreName,
      sourceProcessId:
        candidate.pendingSignal.processId,
      targetProcessId: event.processId,
      releaseStep: candidate.pendingSignal.step,
      acquireStep: event.step,
    })
    candidate.pendingSignal = undefined
  }

  const timeline = [
    ...context.executionHistory
      .filter((event) => event.semaphoreEvent)
      .map((event) => ({
        kind: 'SEMAPHORE' as const,
        step: event.step,
        event,
      })),
    ...events.map((event) => ({
      kind: 'MEMORY' as const,
      step: event.step,
      event,
    })),
  ].sort((first, second) => {
    if (first.step !== second.step) {
      return first.step - second.step
    }

    return first.kind === 'SEMAPHORE'
      ? -1
      : 1
  })

  for (const item of timeline) {
    if (item.kind === 'MEMORY') {
      const active =
        activeByProcess.get(
          item.event.processId,
        )

      activeSections.set(
        item.event,
        new Set(
          [...(active?.entries() ?? [])]
            .filter(([, count]) => count > 0)
            .map(([name]) => name),
        ),
      )

      continue
    }

    const executionEvent = item.event
    const semaphoreEvent =
      executionEvent.semaphoreEvent

    if (
      !semaphoreEvent
      || semaphoreEvent.status !== 'SUCCEEDED'
    ) {
      continue
    }

    let active = activeByProcess.get(
      executionEvent.processId,
    )

    if (!active) {
      active = new Map<string, number>()
      activeByProcess.set(
        executionEvent.processId,
        active,
      )
    }

    const name = semaphoreEvent.semaphoreName
    const count = active.get(name) ?? 0

    if (semaphoreEvent.operation === 'P') {
      active.set(name, count + 1)
      continue
    }

    if (count <= 1) {
      active.delete(name)
    } else {
      active.set(name, count - 1)
    }
  }

  return {
    activeSections,
    validMutexes: new Set(
      [...validMutexes.entries()]
        .filter(([, isValid]) => isValid)
        .map(([name]) => name),
    ),
    directSignals: [
      ...signalingCandidates.values(),
    ]
      .filter((candidate) => candidate.isValid)
      .flatMap((candidate) => candidate.signals),
  }
}

function findDirectSemaphoreSignal(
  first: MicroOperationEvent,
  second: MicroOperationEvent,
  analysis: SemaphoreAnalysis,
): DirectSemaphoreSignal | undefined {
  return analysis.directSignals.find(
    (signal) =>
      signal.sourceProcessId === first.processId
      && first.step < signal.releaseStep
      && signal.releaseStep < signal.acquireStep
      && signal.targetProcessId === second.processId
      && signal.acquireStep < second.step,
  )
}

function findSharedSemaphoreSections(
  first: MicroOperationEvent,
  second: MicroOperationEvent,
  analysis: SemaphoreAnalysis,
): string[] {
  const firstSections =
    analysis.activeSections.get(first)
    ?? new Set<string>()

  const secondSections =
    analysis.activeSections.get(second)
    ?? new Set<string>()

  return [...firstSections]
    .filter((name) => secondSections.has(name))
    .sort()
}

export function findMemoryAccessConflicts(
  events: readonly MicroOperationEvent[],
  context?: MemoryAccessAnalysisContext,
): MemoryAccessConflict[] {
  const conflicts: MemoryAccessConflict[] = []
  const semaphoreAnalysis = context
    ? analyzeSemaphoreSections(events, context)
    : undefined

  for (let i = 0; i < events.length; i += 1) {
    const first = events[i]

    if (
      !isMemoryAccess(first)
      || !first.location
    ) {
      continue
    }

    for (
      let j = i + 1;
      j < events.length;
      j += 1
    ) {
      const second = events[j]

      if (
        !isMemoryAccess(second)
        || !second.location
      ) {
        continue
      }

      if (
        first.processId === second.processId
      ) {
        continue
      }

      if (
        !sameMemoryLocation(
          first.location,
          second.location,
        )
      ) {
        continue
      }

      if (!includesWrite(first, second)) {
        continue
      }

      const bothInsideAtomic =
        first.atomicDepth > 0
        && second.atomicDepth > 0

      const sharedSemaphoreSections =
        semaphoreAnalysis
          ? findSharedSemaphoreSections(
              first,
              second,
              semaphoreAnalysis,
            )
          : []

      const mutexSemaphore =
        sharedSemaphoreSections.find(
          (name) =>
            semaphoreAnalysis?.validMutexes.has(
              name,
            ),
        )

      const directSemaphoreSignal =
        semaphoreAnalysis
          ? findDirectSemaphoreSignal(
              first,
              second,
              semaphoreAnalysis,
            )
          : undefined

      const classification = bothInsideAtomic
        ? 'SYNCHRONIZED'
        : mutexSemaphore
          ? 'SYNCHRONIZED'
          : directSemaphoreSignal
            ? 'SYNCHRONIZED'
            : sharedSemaphoreSections.length > 0
              ? 'UNKNOWN'
              : 'POTENTIAL_RACE'

      const reason = bothInsideAtomic
        ? { type: 'ATOMIC_REGION' as const }
        : mutexSemaphore
          ? {
              type: 'SEMAPHORE_MUTEX' as const,
              semaphoreName: mutexSemaphore,
            }
          : directSemaphoreSignal
            ? {
                type:
                  'SEMAPHORE_SIGNALING' as const,
                semaphoreName:
                  directSemaphoreSignal.semaphoreName,
              }
            : sharedSemaphoreSections.length > 0
              ? {
                  type:
                    'AMBIGUOUS_SEMAPHORE_PROTOCOL' as const,
                  semaphoreNames:
                    sharedSemaphoreSections,
                }
              : { type: 'UNPROTECTED' as const }

      conflicts.push({
        first,
        second,
        classification,
        reason,
      })
    }
  }

  return conflicts
}
