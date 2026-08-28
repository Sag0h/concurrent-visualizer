import type { MicroOperationEvent } from './MicroOperationEvent'
import type { MemoryConflictClassification } from './MemoryConflictClassification'

export interface MemoryAccessConflict {
  readonly first: MicroOperationEvent
  readonly second: MicroOperationEvent
  readonly classification: MemoryConflictClassification
}
