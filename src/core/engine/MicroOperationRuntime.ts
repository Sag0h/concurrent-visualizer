import type { Expression } from '../expressions/Expression'
import type { RuntimeValue } from '../memory/RuntimeValue'
import type { AssignmentInstruction } from '../instructions/Instruction'
import type { MemoryLocation } from '../memory/MemoryLocation'

export type MicroOperationRuntime =
  | SharedAssignmentRuntime

export interface SharedAssignmentRuntime {
  readonly type: 'SHARED_ASSIGNMENT'
  readonly instruction: AssignmentInstruction

  phase: SharedAssignmentPhase

  pendingExpression: Expression
  pendingTargetIndex?: Expression

  computedValue?: RuntimeValue
  targetLocation?: MemoryLocation
}

export type SharedAssignmentPhase =
  | 'READ'
  | 'COMPUTE'
  | 'TARGET_READ'
  | 'WRITE'
