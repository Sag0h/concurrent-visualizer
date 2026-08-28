import type { Expression } from '../expressions/Expression'
import type { RuntimeValue } from '../memory/RuntimeValue'
import type { AssignmentInstruction } from '../instructions/Instruction'

export type MicroOperationRuntime =
  | SharedAssignmentRuntime

export interface SharedAssignmentRuntime {
  readonly type: 'SHARED_ASSIGNMENT'
  readonly instruction: AssignmentInstruction
  phase: SharedAssignmentPhase
  pendingExpression: Expression
  computedValue?: RuntimeValue
}

export type SharedAssignmentPhase =
  | 'READ'
  | 'COMPUTE'
  | 'WRITE'
