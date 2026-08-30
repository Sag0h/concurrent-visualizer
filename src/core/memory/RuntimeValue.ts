export type PrimitiveValue =
  | number
  | boolean
  | string

export type PrimitiveType =
  | 'int'
  | 'bool'
  | 'string'

export interface QueueValue {
  readonly kind: 'QUEUE'
  readonly elementType: PrimitiveType
  readonly items: PrimitiveValue[]
}

export type RuntimeValue =
  | PrimitiveValue
  | PrimitiveValue[]
  | QueueValue

export function createQueueValue(
  elementType: PrimitiveType,
  items: PrimitiveValue[] = [],
): QueueValue {
  items.forEach((item) => {
    assertPrimitiveType(item, elementType)
  })

  return {
    kind: 'QUEUE',
    elementType,
    items: structuredClone(items),
  }
}

export function isQueueValue(
  value: unknown,
): value is QueueValue {
  return (
    typeof value === 'object'
    && value !== null
    && 'kind' in value
    && value.kind === 'QUEUE'
    && 'elementType' in value
    && (
      value.elementType === 'int'
      || value.elementType === 'bool'
      || value.elementType === 'string'
    )
    && 'items' in value
    && Array.isArray(value.items)
  )
}

export function assertPrimitiveType(
  value: RuntimeValue,
  expectedType: PrimitiveType,
): asserts value is PrimitiveValue {
  const matches =
    (expectedType === 'int' && typeof value === 'number')
    || (expectedType === 'bool' && typeof value === 'boolean')
    || (expectedType === 'string' && typeof value === 'string')

  if (!matches) {
    throw new Error(
      `Queue<${expectedType}> cannot store ${describeRuntimeType(value)}`,
    )
  }
}

export function describeRuntimeType(
  value: RuntimeValue,
): string {
  if (Array.isArray(value)) {
    return 'array'
  }

  if (isQueueValue(value)) {
    return `queue<${value.elementType}>`
  }

  if (typeof value === 'number') {
    return 'int'
  }

  if (typeof value === 'boolean') {
    return 'bool'
  }

  return 'string'
}
