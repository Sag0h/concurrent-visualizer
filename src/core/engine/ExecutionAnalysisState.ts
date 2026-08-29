import type { ExecutionEvent } from './ExecutionEvent'
import type { ExecutionState } from './ExecutionState'
import type { MicroOperationEvent } from './MicroOperationEvent'
import type { Program } from './Program'

export interface MemoryAnalysisState {
  readonly initialSemaphoreValues:
    Record<string, number>
  readonly semaphoreEvents: ExecutionEvent[]
  readonly memoryAccessEvents: MicroOperationEvent[]
}

export interface ExecutionAnalysisState {
  readonly memory: MemoryAnalysisState
}

export function createInitialExecutionAnalysisState(
  program: Program,
): ExecutionAnalysisState {
  return {
    memory: {
      initialSemaphoreValues:
        currentSemaphoreValues(program),
      semaphoreEvents: [],
      memoryAccessEvents: [],
    },
  }
}

export function reconstructExecutionAnalysisState(
  state: ExecutionState,
): ExecutionAnalysisState {
  const initialSemaphoreValues =
    currentSemaphoreValues(state.program)
  const semaphoreEvents = state.history.filter(
    (event) =>
      event.semaphoreEvent?.status === 'SUCCEEDED',
  )

  for (const event of semaphoreEvents) {
    const semaphoreEvent = event.semaphoreEvent

    if (!semaphoreEvent) {
      continue
    }

    const current =
      initialSemaphoreValues[
        semaphoreEvent.semaphoreName
      ] ?? 0

    initialSemaphoreValues[
      semaphoreEvent.semaphoreName
    ] = semaphoreEvent.operation === 'P'
      ? current + 1
      : current - 1
  }

  return {
    memory: {
      initialSemaphoreValues,
      semaphoreEvents:
        structuredClone(semaphoreEvents),
      memoryAccessEvents: structuredClone(
        (state.microOperationHistory ?? [])
          .filter(isMemoryAccess),
      ),
    },
  }
}

export function recordExecutionAnalysisEvent(
  analysis: ExecutionAnalysisState,
  event: ExecutionEvent,
): void {
  if (
    event.semaphoreEvent?.status !== 'SUCCEEDED'
  ) {
    return
  }

  analysis.memory.semaphoreEvents.push(
    structuredClone(event),
  )
}

export function recordMicroOperationAnalysisEvent(
  analysis: ExecutionAnalysisState,
  event: MicroOperationEvent,
): void {
  if (!isMemoryAccess(event)) {
    return
  }

  analysis.memory.memoryAccessEvents.push(
    structuredClone(event),
  )
}

function currentSemaphoreValues(
  program: Program,
): Record<string, number> {
  return Object.fromEntries(
    Object.values(program.semaphores ?? {})
      .map((semaphore) => [
        semaphore.name,
        semaphore.value,
      ]),
  )
}

function isMemoryAccess(
  event: MicroOperationEvent,
): boolean {
  return (
    event.type === 'SHARED_READ'
    || event.type === 'SHARED_WRITE'
  )
}
