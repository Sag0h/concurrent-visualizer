import type { Memory } from '../memory/Memory'
import type { ProcessId } from '../process/ProcessId'
import type { ProcessState } from '../process/ProcessState'
import type { MicroOperationEvent } from './MicroOperationEvent'
import type { MemoryAccessConflict } from './MemoryAccessConflict'
import type { MemoryConflictSummary } from './MemoryConflictSummary'
import type { BlockingReason } from '../process/BlockingReason'
import type {
  DeadlockDiagnostic,
  ProgramExecutionStatus,
} from '../deadlock/DeadlockDiagnostic'
import type { RuntimeDiagnostic } from '../diagnostics/RuntimeDiagnostic'
export interface SimulationSnapshot {
  readonly stepCount: number
  readonly executionStatus: ProgramExecutionStatus
  readonly deadlock?: DeadlockDiagnostic
  readonly runtimeDiagnostics: RuntimeDiagnostic[]
  readonly sharedMemory: Memory
  readonly semaphores: SemaphoreSnapshot[]
  readonly processes: ProcessSnapshot[]
  readonly microOperationHistory: MicroOperationEvent[]
  readonly memoryAccessConflicts: MemoryAccessConflict[]
  readonly memoryConflictSummaries: MemoryConflictSummary[]
}

export interface SemaphoreSnapshot {
  readonly name: string
  readonly value: number
  readonly waitingProcessIds: ProcessId[]
}

export interface FunctionCallSnapshot {
  readonly functionName: string
  readonly localMemory: Memory
}

export interface ProcessSnapshot {
  readonly id: ProcessId
  readonly state: ProcessState
  readonly programCounter: number
  readonly localMemory: Memory
  readonly callStack: FunctionCallSnapshot[]
  readonly blockingReason?: BlockingReason
}
