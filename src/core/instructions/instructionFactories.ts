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
  MonitorWaitInstruction,
  MonitorSignalInstruction,
  MonitorSignalAllInstruction,
  DataStructureOperationInstruction,
  DataStructureOperation,
  DataStructureResultTarget,
  SimulatedOperationInstruction,
} from './Instruction'

import type { Instruction } from './Instruction'
import type { AssignmentTarget } from './AssignmentTarget'
import type { Expression } from '../expressions/Expression'
import type { DeclaredType } from '../language/DeclaredType'

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
  declaredType: DeclaredType,
  initialValue?: Expression,
): DeclareInstruction {
  return {
    type: 'DECLARE',
    scope,
    name,
    declaredType,
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
  semaphoreIndex?: Expression,
): SemaphorePInstruction {
  return {
    type: 'SEMAPHORE_P',
    semaphoreName,
    semaphoreIndex,
  }
}

export function semaphoreVInstruction(
  semaphoreName: string,
  semaphoreIndex?: Expression,
): SemaphoreVInstruction {
  return {
    type: 'SEMAPHORE_V',
    semaphoreName,
    semaphoreIndex,
  }
}

export function monitorWaitInstruction(
  conditionName: string,
): MonitorWaitInstruction {
  return {
    type: 'MONITOR_WAIT',
    conditionName,
  }
}

export function monitorSignalInstruction(
  conditionName: string,
): MonitorSignalInstruction {
  return {
    type: 'MONITOR_SIGNAL',
    conditionName,
  }
}

export function monitorSignalAllInstruction(
  conditionName: string,
): MonitorSignalAllInstruction {
  return {
    type: 'MONITOR_SIGNAL_ALL',
    conditionName,
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

export function arrayRecordFieldTarget(
  arrayName: string,
  index: Expression,
  fieldName: string,
): AssignmentTarget {
  return {
    type: 'ARRAY_RECORD_FIELD',
    arrayName,
    index,
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

export function simulatedOperationInstruction(
  operationName: SimulatedOperationInstruction['operationName'],
  args: Expression[],
  receiverName?: string,
): SimulatedOperationInstruction {
  return {
    type: 'SIMULATED_OPERATION',
    operationName,
    receiverName,
    arguments: args,
  }
}
