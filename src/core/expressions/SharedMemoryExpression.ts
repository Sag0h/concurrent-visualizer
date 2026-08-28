import type { Expression } from './Expression'
import type { MemoryLocation } from '../memory/MemoryLocation'

export interface SharedMemoryRead {
  readonly expression: Expression
  readonly location: MemoryLocation
}
