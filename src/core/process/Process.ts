import type { Instruction } from '../instructions/Instruction'
import type { ProcessId } from './ProcessId'
import type { ProcessState } from './ProcessState'
import type { Memory } from '../memory/Memory'
import type { ExecutionFrame } from './ExecutionFrame'
export interface Process {
  readonly id: ProcessId
  state: ProcessState
  readonly instructions: Instruction[]
  programCounter: number
  localMemory: Memory
  executionStack: ExecutionFrame[]
}
