import type { Expression } from './Expression'
import type {
  RuntimeValue,
} from '../memory/RuntimeValue'
import {
  isPriorityQueueValue,
  isQueueValue,
} from '../memory/RuntimeValue'

export function formatExpression(
  expression: Expression,
): string {
  switch (expression.type) {
    case 'LITERAL':
      return formatRuntimeValue(
        expression.value,
      )

    case 'VARIABLE':
      return expression.name

    case 'BINARY':
      return `(${formatExpression(
        expression.left,
      )} ${expression.operator} ${formatExpression(
        expression.right,
      )})`

    case 'UNARY':
      return `${expression.operator}${formatExpression(
        expression.operand,
      )}`

    case 'ARRAY_ACCESS':
      return `${formatExpression(
        expression.array,
      )}[${formatExpression(
        expression.index,
      )}]`

    case 'FUNCTION_CALL':
      return `${expression.functionName}(${expression.arguments
        .map(formatExpression)
        .join(', ')})`
  }
}

function formatRuntimeValue(
  value: RuntimeValue,
): string {
  if (isQueueValue(value)) {
    return `queue[${value.items
      .map(formatRuntimeValue)
      .join(', ')}]`
  }

  if (isPriorityQueueValue(value)) {
    return `priority_queue[${value.items
      .map((item) => `(${formatRuntimeValue(item.value)}, ${item.priority})`)
      .join(', ')}]`
  }

  if (typeof value === 'string') {
    return `"${value}"`
  }

  if (Array.isArray(value)) {
    return `[${value
      .map(formatRuntimeValue)
      .join(', ')}]`
  }

  return String(value)
}
