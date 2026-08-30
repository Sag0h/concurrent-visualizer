import type { Expression } from '../expressions/Expression'

export interface VariableAssignmentTarget {
  readonly type: 'VARIABLE'
  readonly name: string
}

export interface ArrayAssignmentTarget {
  readonly type: 'ARRAY_ACCESS'
  readonly arrayName: string
  readonly index: Expression
}

export interface RecordFieldAssignmentTarget {
  readonly type: 'RECORD_FIELD'
  readonly recordName: string
  readonly fieldName: string
}

export type AssignmentTarget =
  | VariableAssignmentTarget
  | ArrayAssignmentTarget
  | RecordFieldAssignmentTarget
