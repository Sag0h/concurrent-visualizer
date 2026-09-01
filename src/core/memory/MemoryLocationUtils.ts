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
    left.type === 'RECORD_FIELD'
    && right.type === 'RECORD_FIELD'
  ) {
    return (
      left.recordName === right.recordName
      && left.fieldName === right.fieldName
    )
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

  if (
    left.type === 'ARRAY_RECORD_FIELD'
    && right.type === 'ARRAY_RECORD_FIELD'
  ) {
    return (
      left.arrayName === right.arrayName
      && left.index === right.index
      && left.fieldName === right.fieldName
    )
  }

  return false
}
