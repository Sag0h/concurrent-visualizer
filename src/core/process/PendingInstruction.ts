import type { AssignmentTarget } from '../instructions/AssignmentTarget'
import type {
  IfInstruction,
  WhileInstruction,
  RepeatUntilInstruction,
  ReturnInstruction,
  CallInstruction,
} from '../instructions/Instruction'

import type { ExecutionFrame } from './ExecutionFrame'

export type PendingInstruction =
  | {
      readonly type: 'DECLARE'
      readonly name: string
      readonly scope: 'LOCAL' | 'SHARED'
    }
  | {
      readonly type: 'ASSIGN'
      readonly target: AssignmentTarget
    }
  | {
      readonly type: 'IF'
      readonly instruction: IfInstruction
    }
  | {
      readonly type: 'WHILE'
      readonly instruction: WhileInstruction
    }
  | {
      readonly type: 'REPEAT_UNTIL'
      readonly instruction: RepeatUntilInstruction
    }
  | {
    readonly type: 'REPEAT_UNTIL_FRAME'
    readonly frame: ExecutionFrame
  }
  | {
    readonly type: 'RETURN'
    readonly instruction: ReturnInstruction
  }
  | {
      readonly type: 'CALL_ARGUMENTS'
      readonly instruction: CallInstruction
      readonly argumentIndex: number
    }
  | {
    readonly type: 'FOR_CONDITION'
    readonly frame: ExecutionFrame
  }