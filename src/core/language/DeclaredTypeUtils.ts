import type { DeclaredType, DeclaredValueType } from './DeclaredType'
import {
  formatCollectionElementType,
  isPriorityQueueValue,
  isQueueValue,
  isRecordValue,
  isStackValue,
  type CollectionElementType,
  type RuntimeValue,
} from '../memory/RuntimeValue'

export function valueMatchesDeclaredType(
  value: RuntimeValue,
  declaredType: DeclaredType,
): boolean {
  switch (declaredType.container) {
    case 'SCALAR':
      return valueMatchesDeclaredValueType(
        value,
        declaredType.valueType,
      )

    case 'ARRAY':
      return Array.isArray(value)
        && value.every((element) =>
          valueMatchesDeclaredValueType(
            element,
            declaredType.elementType,
          ),
        )

    case 'QUEUE':
      return isQueueValue(value)
        && collectionElementTypeMatches(
          value.elementType,
          declaredType.elementType,
        )

    case 'PRIORITY_QUEUE':
      return isPriorityQueueValue(value)
        && collectionElementTypeMatches(
          value.elementType,
          declaredType.elementType,
        )

    case 'STACK':
      return isStackValue(value)
        && collectionElementTypeMatches(
          value.elementType,
          declaredType.elementType,
        )
  }
}

export function formatDeclaredType(
  declaredType: DeclaredType,
): string {
  switch (declaredType.container) {
    case 'SCALAR':
      return formatDeclaredValueType(declaredType.valueType)
    case 'ARRAY':
      return `${formatDeclaredValueType(declaredType.elementType)}[]`
    case 'QUEUE':
      return `queue<${formatDeclaredValueType(declaredType.elementType)}>`
    case 'PRIORITY_QUEUE':
      return `priority_queue<${formatDeclaredValueType(declaredType.elementType)}>`
    case 'STACK':
      return `stack<${formatDeclaredValueType(declaredType.elementType)}>`
  }
}

export function declaredTypesEqual(
  left: DeclaredType,
  right: DeclaredType,
): boolean {
  if (left.container !== right.container) {
    return false
  }

  if (left.container === 'SCALAR' && right.container === 'SCALAR') {
    return declaredValueTypesEqual(
      left.valueType,
      right.valueType,
    )
  }

  if (left.container === 'SCALAR' || right.container === 'SCALAR') {
    return false
  }

  return declaredValueTypesEqual(
    left.elementType,
    right.elementType,
  )
}

function valueMatchesDeclaredValueType(
  value: RuntimeValue,
  declaredType: DeclaredValueType,
): boolean {
  if (declaredType.kind === 'RECORD') {
    return isRecordValue(value)
      && value.recordType === declaredType.recordType
  }

  return (
    (declaredType.primitiveType === 'int'
      && typeof value === 'number')
    || (declaredType.primitiveType === 'bool'
      && typeof value === 'boolean')
    || (declaredType.primitiveType === 'string'
      && typeof value === 'string')
  )
}

function collectionElementTypeMatches(
  actual: CollectionElementType,
  declared: DeclaredValueType,
): boolean {
  return declared.kind === 'PRIMITIVE'
    ? actual === declared.primitiveType
    : typeof actual !== 'string'
      && actual.recordType === declared.recordType
}

function formatDeclaredValueType(
  declaredType: DeclaredValueType,
): string {
  return declaredType.kind === 'PRIMITIVE'
    ? declaredType.primitiveType
    : formatCollectionElementType(declaredType)
}

function declaredValueTypesEqual(
  left: DeclaredValueType,
  right: DeclaredValueType,
): boolean {
  if (left.kind !== right.kind) {
    return false
  }

  return left.kind === 'PRIMITIVE' && right.kind === 'PRIMITIVE'
    ? left.primitiveType === right.primitiveType
    : left.kind === 'RECORD' && right.kind === 'RECORD'
      && left.recordType === right.recordType
}
