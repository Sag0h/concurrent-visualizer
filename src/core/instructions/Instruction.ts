export interface NoOpInstruction {
  readonly type: 'NO_OP'
}

export interface FinishInstruction {
  readonly type: 'FINISH'
}

import type { Expression } from '../expressions/Expression'

export interface AssignmentInstruction {
  readonly type: 'ASSIGN'
  readonly target: string
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