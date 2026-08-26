export interface NoOpInstruction {
  readonly type: 'NO_OP'
}

export interface FinishInstruction {
  readonly type: 'FINISH'
}

export type Instruction =
  | NoOpInstruction
  | FinishInstruction
