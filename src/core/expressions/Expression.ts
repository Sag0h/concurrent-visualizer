import type { RuntimeValue } from '../memory/RuntimeValue'

export interface LiteralExpression {
  readonly type: 'LITERAL'
  readonly value: RuntimeValue
}

export interface VariableExpression {
  readonly type: 'VARIABLE'
  readonly name: string
}

export interface BinaryExpression {
  readonly type: 'BINARY'
  readonly operator:
    | '+'
    | '-'
    | '*'
    | '/'
    | '=='
    | '!='
    | '<'
    | '<='
    | '>'
    | '>='
    | '&&'
    | '||'
  readonly left: Expression
  readonly right: Expression
}

export interface UnaryExpression {
  readonly type: 'UNARY'
  readonly operator: '!' | '-'
  readonly operand: Expression
}

export interface ArrayAccessExpression {
  readonly type: 'ARRAY_ACCESS'
  readonly array: Expression
  readonly index: Expression
}
export interface FunctionCallExpression {
  readonly type: 'FUNCTION_CALL'
  readonly functionName: string
  readonly arguments: Expression[]
}

export interface FieldAccessExpression {
  readonly type: 'FIELD_ACCESS'
  readonly record: Expression
  readonly fieldName: string
}

export type Expression =
  | LiteralExpression
  | VariableExpression
  | BinaryExpression
  | UnaryExpression
  | ArrayAccessExpression
  | FunctionCallExpression
  | FieldAccessExpression
