import type { MicroOperationEvent } from './MicroOperationEvent'
import type { MemoryAccessConflict } from './MemoryAccessConflict'
import { sameMemoryLocation } from '../memory/MemoryLocationUtils'

function isMemoryAccess(
  event: MicroOperationEvent,
): boolean {
  return (
    event.type === 'SHARED_READ'
    || event.type === 'SHARED_WRITE'
  )
}

function includesWrite(
  first: MicroOperationEvent,
  second: MicroOperationEvent,
): boolean {
  return (
    first.type === 'SHARED_WRITE'
    || second.type === 'SHARED_WRITE'
  )
}

export function findMemoryAccessConflicts(
  events: readonly MicroOperationEvent[],
): MemoryAccessConflict[] {
  const conflicts: MemoryAccessConflict[] = []

  for (let i = 0; i < events.length; i += 1) {
    const first = events[i]

    if (
      !isMemoryAccess(first)
      || !first.location
    ) {
      continue
    }

    for (
      let j = i + 1;
      j < events.length;
      j += 1
    ) {
      const second = events[j]

      if (
        !isMemoryAccess(second)
        || !second.location
      ) {
        continue
      }

      if (
        first.processId === second.processId
      ) {
        continue
      }

      if (
        !sameMemoryLocation(
          first.location,
          second.location,
        )
      ) {
        continue
      }

      if (!includesWrite(first, second)) {
        continue
      }

      conflicts.push({
        first,
        second,
        classification: 'POTENTIAL_RACE',
      })
    }
  }

  return conflicts
}
