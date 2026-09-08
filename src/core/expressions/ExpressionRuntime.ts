import type {
  Expression,
  FunctionCallExpression,
} from './Expression'
import type { RuntimeValue } from '../memory/RuntimeValue'

export interface PendingFunctionArguments {
  pendingArguments: Expression[]
  argumentIndex: number
  argumentValues: RuntimeValue[]
}

export interface PendingExpression {
  readonly expression: Expression
  readonly activeCall?: FunctionCallExpression
  readonly functionArguments?: PendingFunctionArguments
}

export type ExpressionRuntimeStatus =
  | 'IDLE'
  | 'WAITING_FOR_FUNCTION'
  | 'DONE'
