import type { Instruction } from '../instructions/Instruction'

export interface FunctionDefinition {
  readonly name: string
  readonly parameters: string[]
  readonly body: Instruction[]
}
