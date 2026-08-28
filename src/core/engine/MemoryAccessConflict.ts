import type { MicroOperationEvent } from './MicroOperationEvent'

export interface MemoryAccessConflict {
  readonly first: MicroOperationEvent
  readonly second: MicroOperationEvent
}
