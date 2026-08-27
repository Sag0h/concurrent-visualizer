import type {
  Expression,
  FunctionCallExpression,
} from './Expression'

export interface PendingExpression {
  readonly expression: Expression
  readonly activeCall?: FunctionCallExpression
}

export type ExpressionRuntimeStatus =
  | 'IDLE'
  | 'WAITING_FOR_FUNCTION'
  | 'DONE'
