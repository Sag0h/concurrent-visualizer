import type { Instruction } from '../instructions/Instruction'
import type { ProcessId } from './ProcessId'
import type { ProcessState } from './ProcessState'
import type { Memory } from '../memory/Memory'
import type { ExecutionFrame } from './ExecutionFrame'
import type { FunctionCallFrame } from './FunctionCallFrame'
import type { RuntimeValue } from '../memory/RuntimeValue'

import type { PendingInstruction } from './PendingInstruction'

import type {
  ExpressionRuntimeStatus,
  PendingExpression,
} from '../expressions/ExpressionRuntime'

export interface Process {
  readonly id: ProcessId
  state: ProcessState
  readonly instructions: Instruction[]
  programCounter: number
  localMemory: Memory
  executionStack: ExecutionFrame[]
  callStack: FunctionCallFrame[]
  lastReturnValue?: RuntimeValue
  pendingExpression?: PendingExpression
  expressionRuntimeStatus: ExpressionRuntimeStatus
  pendingInstruction?: PendingInstruction
}
