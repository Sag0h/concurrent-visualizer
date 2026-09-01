export type PrimitiveValue =
  | number
  | boolean
  | string

export type PrimitiveType =
  | 'int'
  | 'bool'
  | 'string'

export type CollectionElementType =
  | PrimitiveType
  | {
      readonly kind: 'RECORD'
      readonly recordType: string
    }

export function isPrimitiveValue(
  value: unknown,
): value is PrimitiveValue {
  return (
    typeof value === 'number'
    || typeof value === 'boolean'
    || typeof value === 'string'
  )
}

export interface QueueValue {
  readonly kind: 'QUEUE'
  readonly elementType: CollectionElementType
  readonly items: CollectionElementValue[]
}

export interface PriorityQueueItem {
  readonly value: CollectionElementValue
  readonly priority: number
}

export interface PriorityQueueValue {
  readonly kind: 'PRIORITY_QUEUE'
  readonly elementType: CollectionElementType
  readonly items: PriorityQueueItem[]
}

export interface StackValue {
  readonly kind: 'STACK'
  readonly elementType: CollectionElementType
  readonly items: CollectionElementValue[]
}

export interface RecordValue {
  readonly kind: 'RECORD'
  readonly recordType: string
  readonly fields: Record<string, PrimitiveValue>
}

export type CollectionElementValue =
  | PrimitiveValue
  | RecordValue

export type ArrayElementValue =
  | PrimitiveValue
  | RecordValue

export type ArrayValue = ArrayElementValue[]

export type RuntimeValue =
  | PrimitiveValue
  | ArrayValue
  | QueueValue
  | PriorityQueueValue
  | StackValue
  | RecordValue

export function createRecordValue(
  recordType: string,
  fields: Record<string, PrimitiveValue>,
): RecordValue {
  return {
    kind: 'RECORD',
    recordType,
    fields: structuredClone(fields),
  }
}

export function createQueueValue(
  elementType: CollectionElementType,
  items: CollectionElementValue[] = [],
): QueueValue {
  items.forEach((item) => {
    assertCollectionElementType(item, elementType)
  })

  return {
    kind: 'QUEUE',
    elementType,
    items: structuredClone(items),
  }
}

export function createPriorityQueueValue(
  elementType: CollectionElementType,
  items: PriorityQueueItem[] = [],
): PriorityQueueValue {
  items.forEach((item) => {
    assertCollectionElementType(
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

export function createStackValue(
  elementType: CollectionElementType,
  items: CollectionElementValue[] = [],
): StackValue {
  items.forEach((item) => {
    assertCollectionElementType(item, elementType, 'Stack')
  })

  return {
    kind: 'STACK',
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
    && isCollectionElementType(value.elementType)
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
    && isCollectionElementType(value.elementType)
    && 'items' in value
    && Array.isArray(value.items)
  )
}

export function isStackValue(
  value: unknown,
): value is StackValue {
  return (
    typeof value === 'object'
    && value !== null
    && 'kind' in value
    && value.kind === 'STACK'
    && 'elementType' in value
    && isCollectionElementType(value.elementType)
    && 'items' in value
    && Array.isArray(value.items)
  )
}

export function isRecordValue(
  value: unknown,
): value is RecordValue {
  return (
    typeof value === 'object'
    && value !== null
    && 'kind' in value
    && value.kind === 'RECORD'
    && 'recordType' in value
    && typeof value.recordType === 'string'
    && 'fields' in value
    && typeof value.fields === 'object'
    && value.fields !== null
    && !Array.isArray(value.fields)
  )
}

export function resolveRecordGetterFieldName(
  record: RecordValue,
  getterName: string,
): string {
  if (
    !getterName.startsWith('get')
    || getterName.length === 3
  ) {
    throw new Error(
      `Record method "${getterName}" is not a getter`,
    )
  }

  const requestedField = getterName
    .slice(3)
    .toLocaleLowerCase()
  const fieldName = Object.keys(record.fields).find(
    (candidate) =>
      candidate.toLocaleLowerCase() === requestedField,
  )

  if (!fieldName) {
    throw new Error(
      `Record "${record.recordType}" has no field for getter "${getterName}"`,
    )
  }

  return fieldName
}

export function isAnyQueueValue(
  value: unknown,
): value is QueueValue | PriorityQueueValue {
  return isQueueValue(value) || isPriorityQueueValue(value)
}

export function isDataStructureValue(
  value: unknown,
): value is QueueValue | PriorityQueueValue | StackValue {
  return isAnyQueueValue(value) || isStackValue(value)
}

export function enqueuePriorityItem(
  queue: PriorityQueueValue,
  item: PriorityQueueItem,
): void {
  assertCollectionElementType(
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

export function isCollectionElementType(
  value: unknown,
): value is CollectionElementType {
  return (
    value === 'int'
    || value === 'bool'
    || value === 'string'
    || (
      typeof value === 'object'
      && value !== null
      && 'kind' in value
      && value.kind === 'RECORD'
      && 'recordType' in value
      && typeof value.recordType === 'string'
    )
  )
}

export function formatCollectionElementType(
  elementType: CollectionElementType,
): string {
  return typeof elementType === 'string'
    ? elementType
    : elementType.recordType
}

export function assertCollectionElementType(
  value: RuntimeValue,
  expectedType: CollectionElementType,
  containerName = 'Queue',
): asserts value is CollectionElementValue {
  if (typeof expectedType === 'string') {
    assertPrimitiveType(value, expectedType, containerName)
    return
  }

  if (
    !isRecordValue(value)
    || value.recordType !== expectedType.recordType
  ) {
    throw new Error(
      `${containerName}<${expectedType.recordType}> cannot store ${describeRuntimeType(value)}`,
    )
  }
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
    return `queue<${formatCollectionElementType(value.elementType)}>`
  }

  if (isPriorityQueueValue(value)) {
    return `priority_queue<${formatCollectionElementType(value.elementType)}>`
  }

  if (isStackValue(value)) {
    return `stack<${formatCollectionElementType(value.elementType)}>`
  }

  if (isRecordValue(value)) {
    return value.recordType
  }

  if (typeof value === 'number') {
    return 'int'
  }

  if (typeof value === 'boolean') {
    return 'bool'
  }

  return 'string'
}

export function assertArrayElementCompatible(
  previousValue: ArrayElementValue,
  value: RuntimeValue,
  locationDescription: string,
): asserts value is ArrayElementValue {
  if (isRecordValue(previousValue)) {
    if (
      !isRecordValue(value)
      || value.recordType !== previousValue.recordType
    ) {
      throw new Error(
        `${locationDescription} requires ${previousValue.recordType} but received ${describeRuntimeType(value)}`,
      )
    }

    return
  }

  if (
    !isPrimitiveValue(value)
    || typeof value !== typeof previousValue
  ) {
    throw new Error(
      `${locationDescription} requires ${describeRuntimeType(previousValue)} but received ${describeRuntimeType(value)}`,
    )
  }
}
