import type { MicroOperationEvent } from './MicroOperationEvent'
import type { MemoryConflictClassification } from './MemoryConflictClassification'
import type { MemoryConflictReason } from './MemoryConflictReason'

export interface MemoryAccessConflict {
  readonly first: MicroOperationEvent
  readonly second: MicroOperationEvent
  readonly classification: MemoryConflictClassification
  readonly reason: MemoryConflictReason
}
