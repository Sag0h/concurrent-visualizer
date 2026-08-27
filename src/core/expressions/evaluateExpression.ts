import type { RuntimeValue } from '../memory/RuntimeValue'
import type { Expression } from './Expression'
import type { ExpressionContext } from './ExpressionContext'

export function evaluateExpression(
  expression: Expression,
  context: ExpressionContext,
): RuntimeValue {
  switch (expression.type) {
    case 'LITERAL':
      return expression.value

    case 'VARIABLE':
      return readVariable(expression.name, context)

    case 'BINARY':
      return evaluateBinaryExpression(expression, context)
    
    case 'UNARY':
      return evaluateUnaryExpression(expression, context)
    case 'ARRAY_ACCESS':
      return evaluateArrayAccess(expression, context)  
    }
}

function readVariable(
  name: string,
  context: ExpressionContext,
): RuntimeValue {
  if (name in context.localMemory) {
    return context.localMemory[name]
  }

  if (name in context.sharedMemory) {
    return context.sharedMemory[name]
  }

  throw new Error(`Variable "${name}" is not defined`)
}

function evaluateBinaryExpression(
  expression: Extract<Expression, { type: 'BINARY' }>,
  context: ExpressionContext,
): RuntimeValue {
  const left = evaluateExpression(expression.left, context)
  const right = evaluateExpression(expression.right, context)

  switch (expression.operator) {
    case '+':
      return addValues(left, right)

    case '-':
      return requireNumber(left) - requireNumber(right)

    case '*':
      return requireNumber(left) * requireNumber(right)

    case '/':
      return requireNumber(left) / requireNumber(right)

    case '==':
      return left === right

    case '!=':
      return left !== right

    case '<':
      return requireNumber(left) < requireNumber(right)

    case '<=':
      return requireNumber(left) <= requireNumber(right)

    case '>':
      return requireNumber(left) > requireNumber(right)

    case '>=':
      return requireNumber(left) >= requireNumber(right)

    case '&&':
      return requireBoolean(left) && requireBoolean(right)

    case '||':
      return requireBoolean(left) || requireBoolean(right)
  }
}

function evaluateUnaryExpression(
  expression: Extract<Expression, { type: 'UNARY' }>,
  context: ExpressionContext,
): RuntimeValue {
  const operand = evaluateExpression(
    expression.operand,
    context,
  )

  switch (expression.operator) {
    case '!':
      return !requireBoolean(operand)
  }
}

function addValues(
  left: RuntimeValue,
  right: RuntimeValue,
): RuntimeValue {
  if (
    typeof left === 'number'
    && typeof right === 'number'
  ) {
    return left + right
  }

  if (
    typeof left === 'string'
    && typeof right === 'string'
  ) {
    return left + right
  }

  throw new Error(
    'Operator "+" requires two numbers or two strings',
  )
}

function requireNumber(value: RuntimeValue): number {
  if (typeof value !== 'number') {
    throw new Error(`Expected number but received ${typeof value}`)
  }

  return value
}

function requireBoolean(value: RuntimeValue): boolean {
  if (typeof value !== 'boolean') {
    throw new Error(`Expected boolean but received ${typeof value}`)
  }

  return value
}

function evaluateArrayAccess(
  expression: Extract<Expression, { type: 'ARRAY_ACCESS' }>,
  context: ExpressionContext,
): RuntimeValue {
  const array = evaluateExpression(
    expression.array,
    context,
  )

  const index = evaluateExpression(
    expression.index,
    context,
  )

  if (!Array.isArray(array)) {
    throw new Error('Expected array')
  }

  if (
    typeof index !== 'number'
    || !Number.isInteger(index)
  ) {
    throw new Error('Array index must be an integer')
  }

  if (index < 0 || index >= array.length) {
    throw new Error(`Array index ${index} is out of bounds`)
  }

  return array[index]
}