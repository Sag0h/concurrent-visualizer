import type { Expression } from './Expression'

export interface SharedMemoryRead {
  readonly expression: Expression
  readonly variableName: string
}
