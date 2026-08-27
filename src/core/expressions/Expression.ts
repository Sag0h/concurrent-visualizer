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
  readonly operator: '!'
  readonly operand: Expression
}

export interface ArrayAccessExpression {
  readonly type: 'ARRAY_ACCESS'
  readonly array: Expression
  readonly index: Expression
}

export type Expression =
  | LiteralExpression
  | VariableExpression
  | BinaryExpression
  | UnaryExpression
  | ArrayAccessExpression