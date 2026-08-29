import type { ExecutionState } from '../engine/ExecutionState'

export function createSemanticStateKey(
  state: ExecutionState,
): string {
  return createCanonicalValueKey(state.program)
}

export function createCanonicalValueKey(
  value: unknown,
): string {
  return JSON.stringify(normalize(value))
}

function normalize(value: unknown): unknown {
  if (
    value === null
    || typeof value === 'string'
    || typeof value === 'boolean'
  ) {
    return value
  }

  if (typeof value === 'number') {
    if (Number.isNaN(value)) {
      return { $number: 'NaN' }
    }

    if (value === Number.POSITIVE_INFINITY) {
      return { $number: 'Infinity' }
    }

    if (value === Number.NEGATIVE_INFINITY) {
      return { $number: '-Infinity' }
    }

    return value
  }

  if (Array.isArray(value)) {
    return value.map((item) =>
      item === undefined
        ? null
        : normalize(item),
    )
  }

  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, item]) => item !== undefined)
        .sort(([left], [right]) =>
          left.localeCompare(right),
        )
        .map(([key, item]) => [
          key,
          normalize(item),
        ]),
    )
  }

  throw new Error(
    `Cannot serialize semantic state value of type ${typeof value}`,
  )
}
