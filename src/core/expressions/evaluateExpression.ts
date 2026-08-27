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
      return requireNumber(left) + requireNumber(right)

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
