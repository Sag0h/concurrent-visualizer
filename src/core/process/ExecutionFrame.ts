import type { Expression } from '../expressions/Expression'
import type { Instruction } from '../instructions/Instruction'

export type FrameCompletionMode =
  | 'ADVANCE_PARENT'
  | 'REPEAT_PARENT'
  | 'CHECK_REPEAT_UNTIL'
export interface ExecutionFrame {
  readonly instructions: Instruction[]
  programCounter: number
  readonly completionMode: FrameCompletionMode
  readonly repeatCondition?: Expression
}
