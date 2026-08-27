import type { Expression } from '../expressions/Expression'
import type { AssignmentTarget } from './AssignmentTarget'
export interface NoOpInstruction {
  readonly type: 'NO_OP'
}

export interface FinishInstruction {
  readonly type: 'FINISH'
}


export interface AssignmentInstruction {
  readonly type: 'ASSIGN'
  readonly target: AssignmentTarget
  readonly expression: Expression
}

export interface DeclareInstruction {
  readonly type: 'DECLARE'
  readonly scope: 'LOCAL' | 'SHARED'
  readonly name: string
  readonly initialValue: Expression
}



export type Instruction =
  | NoOpInstruction
  | FinishInstruction
  | AssignmentInstruction
  | DeclareInstruction