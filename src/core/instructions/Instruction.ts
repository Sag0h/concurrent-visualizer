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

export interface IfInstruction {
  readonly type: 'IF'
  readonly condition: Expression
  readonly thenBranch: Instruction[]
  readonly elseBranch: Instruction[]
}

export interface WhileInstruction {
  readonly type: 'WHILE'
  readonly condition: Expression
  readonly body: Instruction[]
}

export interface RepeatUntilInstruction {
  readonly type: 'REPEAT_UNTIL'
  readonly condition: Expression
  readonly body: Instruction[]
}
export interface ForInstruction {
  readonly type: 'FOR'
  readonly initializer: Instruction
  readonly condition: Expression
  readonly increment: Instruction
  readonly body: Instruction[]
}

export interface ForeachInstruction {
  readonly type: 'FOREACH'
  readonly itemName: string
  readonly collection: Expression
  readonly body: Instruction[]
}

export interface BreakInstruction {
  readonly type: 'BREAK'
}

export interface ContinueInstruction {
  readonly type: 'CONTINUE'
}

export type Instruction =
  | NoOpInstruction
  | FinishInstruction
  | AssignmentInstruction
  | DeclareInstruction
  | IfInstruction
  | WhileInstruction
  | RepeatUntilInstruction
  | ForInstruction
  | ForeachInstruction
  | BreakInstruction
  | ContinueInstruction