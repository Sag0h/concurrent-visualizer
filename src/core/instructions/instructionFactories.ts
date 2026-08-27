import type {
  AssignmentInstruction,
  FinishInstruction,
  NoOpInstruction,
  DeclareInstruction,
} from './Instruction'

import type { Expression } from '../expressions/Expression'

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

export function declare(
  scope: DeclareInstruction['scope'],
  name: string,
  initialValue: Expression,
): DeclareInstruction {
  return {
    type: 'DECLARE',
    scope,
    name,
    initialValue,
  }
}

export function assign(
  target: string,
  expression: Expression,
): AssignmentInstruction {
  return {
    type: 'ASSIGN',
    target,
    expression,
  }
}