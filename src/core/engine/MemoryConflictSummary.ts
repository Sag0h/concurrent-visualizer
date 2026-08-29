import type { MemoryLocation } from '../memory/MemoryLocation'
import type { ProcessId } from '../process/ProcessId'

export interface MemoryConflictSummary {
  readonly location: MemoryLocation
  readonly processes: ProcessId[]
  conflictCount: number
  potentialRaceCount: number
  mutualExclusionViolationCount: number
  synchronizedCount: number
  unknownCount: number
  readCount: number
  writeCount: number
}
