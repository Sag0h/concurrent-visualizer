import type { AssignmentTarget } from '../instructions/AssignmentTarget'
import type {
  IfInstruction,
  WhileInstruction,
  RepeatUntilInstruction,
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