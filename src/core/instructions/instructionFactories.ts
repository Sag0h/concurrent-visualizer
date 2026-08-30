import type {
  AssignmentInstruction,
  FinishInstruction,
  NoOpInstruction,
  DeclareInstruction,
  IfInstruction,
  WhileInstruction,
  RepeatUntilInstruction,
  ForInstruction,
  ForeachInstruction,
  BreakInstruction,
  ContinueInstruction,
  CallInstruction,
  ReturnInstruction,
  AwaitInstruction,
  AtomicInstruction,
  SemaphoreVInstruction,
  SemaphorePInstruction,
  DataStructureOperationInstruction,
  DataStructureOperation,
  DataStructureResultTarget,
} from './Instruction'

import type { Instruction } from './Instruction'
import type { AssignmentTarget } from './AssignmentTarget'
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
  target: AssignmentTarget,
  expression: Expression,
): AssignmentInstruction {
  return {
    type: 'ASSIGN',
    target,
    expression,
  }
}

export function variableTarget(
  name: string,
): AssignmentTarget {
  return {
    type: 'VARIABLE',
    name,
  }
}

export function arrayTarget(
  arrayName: string,
  index: Expression,
): AssignmentTarget {
  return {
    type: 'ARRAY_ACCESS',
    arrayName,
    index,
  }
}

export function ifInstruction(
  condition: Expression,
  thenBranch: Instruction[],
  elseBranch: Instruction[] = [],
): IfInstruction {
  return {
    type: 'IF',
    condition,
    thenBranch,
    elseBranch,
  }
}

export function whileInstruction(
  condition: Expression,
  body: Instruction[],
): WhileInstruction {
  return {
    type: 'WHILE',
    condition,
    body,
  }
}

export function repeatUntilInstruction(
  body: Instruction[],
  condition: Expression,
): RepeatUntilInstruction {
  return {
    type: 'REPEAT_UNTIL',
    body,
    condition,
  }
}

export function forInstruction(
  initializer: Instruction,
  condition: Expression,
  increment: Instruction,
  body: Instruction[],
): ForInstruction {
  return {
    type: 'FOR',
    initializer,
    condition,
    increment,
    body,
  }
}

export function foreachInstruction(
  itemName: string,
  collection: Expression,
  body: Instruction[],
): ForeachInstruction {
  return {
    type: 'FOREACH',
    itemName,
    collection,
    body,
  }
}

export function breakInstruction(): BreakInstruction {
  return {
    type: 'BREAK',
  }
}

export function continueInstruction(): ContinueInstruction {
  return {
    type: 'CONTINUE',
  }
}

export function callInstruction(
  functionName: string,
  args: Expression[],
): CallInstruction {
  return {
    type: 'CALL',
    functionName,
    arguments: args,
  }
}

export function returnInstruction(
  value?: Expression,
): ReturnInstruction {
  return {
    type: 'RETURN',
    value,
  }
}

export function atomicInstruction(
  body: Instruction[],
): AtomicInstruction {
  return {
    type: 'ATOMIC',
    body,
  }
}

export function awaitInstruction(
  condition: Expression,
  body: Instruction[] = [],
): AwaitInstruction {
  return {
    type: 'AWAIT',
    condition,
    body,
  }
}

export function semaphorePInstruction(
  semaphoreName: string,
): SemaphorePInstruction {
  return {
    type: 'SEMAPHORE_P',
    semaphoreName,
  }
}

export function semaphoreVInstruction(
  semaphoreName: string,
): SemaphoreVInstruction {
  return {
    type: 'SEMAPHORE_V',
    semaphoreName,
  }
}

export function recordFieldTarget(
  recordName: string,
  fieldName: string,
): AssignmentTarget {
  return {
    type: 'RECORD_FIELD',
    recordName,
    fieldName,
  }
}

export function dataStructureOperationInstruction(
  structureName: string,
  operation: DataStructureOperation,
  options: {
    readonly argument?: Expression
    readonly priorityArgument?: Expression
    readonly resultTarget?: DataStructureResultTarget
  } = {},
): DataStructureOperationInstruction {
  return {
    type: 'DATA_STRUCTURE_OPERATION',
    structureName,
    operation,
    argument: options.argument,
    priorityArgument: options.priorityArgument,
    resultTarget: options.resultTarget,
  }
}
