import type { PendingExpression } from '../expressions/ExpressionRuntime'
import type { PendingInstruction } from './PendingInstruction'

export interface PendingEvaluation {
  pendingExpression: PendingExpression
  readonly pendingInstruction: PendingInstruction
}
