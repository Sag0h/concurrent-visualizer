import type { Expression } from '../expressions/Expression'
import type { Instruction } from '../instructions/Instruction'
import type { ArrayElementValue } from '../memory/RuntimeValue'

export type FrameCompletionMode =
  | 'ADVANCE_PARENT'
  | 'REPEAT_PARENT'
  | 'CHECK_REPEAT_UNTIL'
  | 'FOR_CHECK'
  | 'FOR_INCREMENT'
  | 'FOREACH_NEXT'
  | 'FUNCTION_RETURN'
  | 'EXIT_ATOMIC'

export interface ForLoopRuntime {
  readonly condition: Expression
  readonly body: Instruction[]
  readonly increment: Instruction
}

export interface ForeachLoopRuntime {
  readonly itemName: string
  readonly values: ArrayElementValue[]
  readonly body: Instruction[]
  index: number
}

export interface ExecutionFrame {
  readonly instructions: Instruction[]
  programCounter: number
  readonly completionMode: FrameCompletionMode
  readonly repeatCondition?: Expression
  readonly forLoop?: ForLoopRuntime
  readonly foreachLoop?: ForeachLoopRuntime
}
