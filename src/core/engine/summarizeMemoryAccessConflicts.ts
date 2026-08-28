import type { MemoryAccessConflict } from './MemoryAccessConflict'
import type { MemoryConflictSummary } from './MemoryConflictSummary'
import type { MemoryLocation } from '../memory/MemoryLocation'
import { sameMemoryLocation } from '../memory/MemoryLocationUtils'

function findSummary(
  summaries: MemoryConflictSummary[],
  location: MemoryLocation,
): MemoryConflictSummary | undefined {
  return summaries.find(
    (summary) =>
      sameMemoryLocation(
        summary.location,
        location,
      ),
  )
}

export function summarizeMemoryAccessConflicts(
  conflicts: readonly MemoryAccessConflict[],
): MemoryConflictSummary[] {
  const summaries: MemoryConflictSummary[] = []

  for (const conflict of conflicts) {
    const location =
      conflict.first.location

    if (!location) {
      continue
    }

    let summary =
      findSummary(
        summaries,
        location,
      )

    if (!summary) {
      summary = {
        location:
          structuredClone(location),
        processes: [],
        conflictCount: 0,
        readCount: 0,
        writeCount: 0,
      }

      summaries.push(summary)
    }

    summary.conflictCount += 1

    const events = [
      conflict.first,
      conflict.second,
    ]

    for (const event of events) {
      if (
        !summary.processes.includes(
          event.processId,
        )
      ) {
        summary.processes.push(
          event.processId,
        )
      }

      if (event.type === 'SHARED_READ') {
        summary.readCount += 1
      }

      if (event.type === 'SHARED_WRITE') {
        summary.writeCount += 1
      }
    }
  }

  return summaries
}
