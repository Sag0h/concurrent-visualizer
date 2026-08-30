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

export interface PriorityQueueItem {
  readonly value: PrimitiveValue
  readonly priority: number
}

export interface PriorityQueueValue {
  readonly kind: 'PRIORITY_QUEUE'
  readonly elementType: PrimitiveType
  readonly items: PriorityQueueItem[]
}

export type RuntimeValue =
  | PrimitiveValue
  | PrimitiveValue[]
  | QueueValue
  | PriorityQueueValue

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

export function createPriorityQueueValue(
  elementType: PrimitiveType,
  items: PriorityQueueItem[] = [],
): PriorityQueueValue {
  items.forEach((item) => {
    assertPrimitiveType(
      item.value,
      elementType,
      'PriorityQueue',
    )
    assertPriority(item.priority)
  })

  const queue: PriorityQueueValue = {
    kind: 'PRIORITY_QUEUE',
    elementType,
    items: [],
  }

  items.forEach((item) => {
    enqueuePriorityItem(queue, item)
  })

  return queue
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

export function isPriorityQueueValue(
  value: unknown,
): value is PriorityQueueValue {
  return (
    typeof value === 'object'
    && value !== null
    && 'kind' in value
    && value.kind === 'PRIORITY_QUEUE'
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

export function isAnyQueueValue(
  value: unknown,
): value is QueueValue | PriorityQueueValue {
  return isQueueValue(value) || isPriorityQueueValue(value)
}

export function enqueuePriorityItem(
  queue: PriorityQueueValue,
  item: PriorityQueueItem,
): void {
  assertPrimitiveType(
    item.value,
    queue.elementType,
    'PriorityQueue',
  )
  assertPriority(item.priority)

  const insertionIndex = queue.items.findIndex(
    (existing) => existing.priority < item.priority,
  )
  const detachedItem = structuredClone(item)

  if (insertionIndex === -1) {
    queue.items.push(detachedItem)
    return
  }

  queue.items.splice(insertionIndex, 0, detachedItem)
}

export function assertPriority(
  priority: RuntimeValue,
): asserts priority is number {
  if (
    typeof priority !== 'number'
    || !Number.isInteger(priority)
  ) {
    throw new Error('Priority must be an integer')
  }
}

export function assertPrimitiveType(
  value: RuntimeValue,
  expectedType: PrimitiveType,
  containerName = 'Queue',
): asserts value is PrimitiveValue {
  const matches =
    (expectedType === 'int' && typeof value === 'number')
    || (expectedType === 'bool' && typeof value === 'boolean')
    || (expectedType === 'string' && typeof value === 'string')

  if (!matches) {
    throw new Error(
      `${containerName}<${expectedType}> cannot store ${describeRuntimeType(value)}`,
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

  if (isPriorityQueueValue(value)) {
    return `priority_queue<${value.elementType}>`
  }

  if (typeof value === 'number') {
    return 'int'
  }

  if (typeof value === 'boolean') {
    return 'bool'
  }

  return 'string'
}
