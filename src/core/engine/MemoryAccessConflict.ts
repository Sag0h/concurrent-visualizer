import type { MicroOperationEvent } from './MicroOperationEvent'
import type { MemoryConflictClassification } from './MemoryConflictClassification'
import type { MemoryConflictReason } from './MemoryConflictReason'
import type { MemoryConflictDiagnostic } from './MemoryConflictDiagnostic'

export interface MemoryAccessConflict {
  readonly first: MicroOperationEvent
  readonly second: MicroOperationEvent
  readonly classification: MemoryConflictClassification
  readonly diagnostic: MemoryConflictDiagnostic
  readonly reason: MemoryConflictReason
}
