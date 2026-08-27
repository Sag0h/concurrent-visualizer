import type { AssignmentTarget } from '../instructions/AssignmentTarget'

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
