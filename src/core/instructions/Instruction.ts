import type { Expression } from '../expressions/Expression'
import type { SourceRange } from '../language/SourceRange'
import type { DeclaredValueType } from '../language/DeclaredType'
import type { AssignmentTarget } from './AssignmentTarget'
export interface NoOpInstruction {
  readonly type: 'NO_OP'
}

export interface FinishInstruction {
  readonly type: 'FINISH'
}


export interface AssignmentInstruction {
  readonly type: 'ASSIGN'
  readonly target: AssignmentTarget
  readonly expression: Expression
}

export interface DeclareInstruction {
  readonly type: 'DECLARE'
  readonly scope: 'LOCAL' | 'SHARED'
  readonly name: string
  readonly initialValue: Expression
}

export interface IfInstruction {
  readonly type: 'IF'
  readonly condition: Expression
  readonly thenBranch: Instruction[]
  readonly elseBranch: Instruction[]
}

export interface WhileInstruction {
  readonly type: 'WHILE'
  readonly condition: Expression
  readonly body: Instruction[]
}

export interface RepeatUntilInstruction {
  readonly type: 'REPEAT_UNTIL'
  readonly condition: Expression
  readonly body: Instruction[]
}
export interface ForInstruction {
  readonly type: 'FOR'
  readonly initializer: Instruction
  readonly condition: Expression
  readonly increment: Instruction
  readonly body: Instruction[]
}

export interface ForeachInstruction {
  readonly type: 'FOREACH'
  readonly itemName: string
  readonly collection: Expression
  readonly body: Instruction[]
}

export interface BreakInstruction {
  readonly type: 'BREAK'
}

export interface ContinueInstruction {
  readonly type: 'CONTINUE'
}

export interface CallInstruction {
  readonly type: 'CALL'
  readonly functionName: string
  readonly arguments: Expression[]
}

export interface ReturnInstruction {
  readonly type: 'RETURN'
  readonly value?: Expression
}

export interface AtomicInstruction {
  readonly type: 'ATOMIC'
  readonly body: Instruction[]
}

export interface AwaitInstruction {
  readonly type: 'AWAIT'
  readonly condition: Expression
  readonly body: Instruction[]
}

export interface SemaphorePInstruction {
  readonly type: 'SEMAPHORE_P'
  readonly semaphoreName: string
}

export interface SemaphoreVInstruction {
  readonly type: 'SEMAPHORE_V'
  readonly semaphoreName: string
}

export type DataStructureOperation =
  | 'ENQUEUE'
  | 'DEQUEUE'
  | 'FRONT'
  | 'PUSH'
  | 'POP'
  | 'TOP'
  | 'IS_EMPTY'
  | 'SIZE'

export type DataStructureResultTarget =
  | {
      readonly type: 'DECLARE'
      readonly scope: 'LOCAL'
      readonly name: string
      readonly valueType: DeclaredValueType
    }
  | {
      readonly type: 'ASSIGN'
      readonly target: AssignmentTarget
    }

export interface DataStructureOperationInstruction {
  readonly type: 'DATA_STRUCTURE_OPERATION'
  readonly structureName: string
  readonly operation: DataStructureOperation
  readonly argument?: Expression
  readonly priorityArgument?: Expression
  readonly resultTarget?: DataStructureResultTarget
}

export interface SimulatedOperationInstruction {
  readonly type: 'SIMULATED_OPERATION'
  readonly operationName: string
  readonly receiverName?: string
  readonly arguments: Expression[]
}

type InstructionWithoutSourceRange =
  | NoOpInstruction
  | FinishInstruction
  | AssignmentInstruction
  | DeclareInstruction
  | IfInstruction
  | WhileInstruction
  | RepeatUntilInstruction
  | ForInstruction
  | ForeachInstruction
  | BreakInstruction
  | ContinueInstruction
  | CallInstruction
  | ReturnInstruction
  | AtomicInstruction
  | AwaitInstruction
  | SemaphorePInstruction
  | SemaphoreVInstruction
  | DataStructureOperationInstruction
  | SimulatedOperationInstruction

export type Instruction = InstructionWithoutSourceRange & {
  /** Present for instructions parsed from source code. */
  readonly sourceRange?: SourceRange
}
