import type { Expression } from '../expressions/Expression'
import type { RuntimeValue } from '../memory/RuntimeValue'
import type {
  AssignmentInstruction,
  SimulatedOperationInstruction,
} from '../instructions/Instruction'
import type { MemoryLocation } from '../memory/MemoryLocation'

export type MicroOperationRuntime =
  | SharedAssignmentRuntime
  | SimulatedOperationRuntime

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

export interface SimulatedOperationRuntime {
  readonly type: 'SIMULATED_OPERATION'
  readonly instruction: SimulatedOperationInstruction
  pendingArguments: Expression[]
  argumentIndex: number
  argumentValues: RuntimeValue[]
  receiver?: {
    readonly name: string
    readonly recordType: string
    readonly scope: 'LOCAL' | 'SHARED'
  }
}
