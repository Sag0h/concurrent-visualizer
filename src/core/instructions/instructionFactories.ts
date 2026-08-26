import type {
  FinishInstruction,
  NoOpInstruction,
} from './Instruction'

export function noOp(): NoOpInstruction {
  return {
    type: 'NO_OP',
  }
}

export function finish(): FinishInstruction {
  return {
    type: 'FINISH',
  }
}
