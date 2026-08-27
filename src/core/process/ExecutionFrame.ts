import type { Instruction } from '../instructions/Instruction'

export interface ExecutionFrame {
  readonly instructions: Instruction[]
  programCounter: number
}
