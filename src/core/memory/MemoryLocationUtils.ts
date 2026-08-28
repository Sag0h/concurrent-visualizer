import type { MemoryLocation } from './MemoryLocation'

export function sameMemoryLocation(
  left: MemoryLocation,
  right: MemoryLocation,
): boolean {
  if (left.type !== right.type) {
    return false
  }

  if (
    left.type === 'VARIABLE'
    && right.type === 'VARIABLE'
  ) {
    return left.name === right.name
  }

  if (
    left.type === 'ARRAY_ELEMENT'
    && right.type === 'ARRAY_ELEMENT'
  ) {
    return (
      left.arrayName === right.arrayName
      && left.index === right.index
    )
  }

  return false
}
