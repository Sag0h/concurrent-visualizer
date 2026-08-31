import type { RuntimeValue } from '../memory/RuntimeValue'
import type {
  BinaryExpression,
  Expression,
  LiteralExpression,
  VariableExpression,
  UnaryExpression,
  ArrayAccessExpression,
  FunctionCallExpression,
  FieldAccessExpression,
  RecordGetterExpression,
} from './Expression'

export function literal(value: RuntimeValue): LiteralExpression {
  return {
    type: 'LITERAL',
    value,
  }
}

export function variable(name: string): VariableExpression {
  return {
    type: 'VARIABLE',
    name,
  }
}

export function unary(
  operator: UnaryExpression['operator'],
  operand: Expression,
): UnaryExpression {
  return {
    type: 'UNARY',
    operator,
    operand,
  }
}

export function binary(
  operator: BinaryExpression['operator'],
  left: Expression,
  right: Expression,
): BinaryExpression {
  return {
    type: 'BINARY',
    operator,
    left,
    right,
  }
}

export function arrayAccess(
  array: Expression,
  index: Expression,
): ArrayAccessExpression {
  return {
    type: 'ARRAY_ACCESS',
    array,
    index,
  }
}

export function functionCall(
  functionName: string,
  args: Expression[],
): FunctionCallExpression {
  return {
    type: 'FUNCTION_CALL',
    functionName,
    arguments: args,
  }
}

export function fieldAccess(
  record: Expression,
  fieldName: string,
): FieldAccessExpression {
  return {
    type: 'FIELD_ACCESS',
    record,
    fieldName,
  }
}

export function recordGetter(
  record: Expression,
  getterName: string,
): RecordGetterExpression {
  return {
    type: 'RECORD_GETTER',
    record,
    getterName,
  }
}
