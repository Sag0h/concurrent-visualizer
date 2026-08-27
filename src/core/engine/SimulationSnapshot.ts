import type { Memory } from '../memory/Memory'
import type { ProcessId } from '../process/ProcessId'
import type { ProcessState } from '../process/ProcessState'

export interface SimulationSnapshot {
  readonly stepCount: number
  readonly sharedMemory: Memory
  readonly processes: ProcessSnapshot[]
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
}