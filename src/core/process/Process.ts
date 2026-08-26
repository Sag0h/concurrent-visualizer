import type { Instruction } from '../instructions/Instruction'
import type { ProcessId } from './ProcessId'
import type { ProcessState } from './ProcessState'

export interface Process {
  readonly id: ProcessId
  state: ProcessState
  readonly instructions: Instruction[]
  programCounter: number
}
