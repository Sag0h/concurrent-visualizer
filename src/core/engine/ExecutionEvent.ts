import type { ProcessId } from '../process/ProcessId'
import type { SourceRange } from '../language/SourceRange'
import type {
  PrimitiveValue,
  RuntimeValue,
} from '../memory/RuntimeValue'

export type AwaitEventStatus =
  | 'BLOCKED'
  | 'ENABLED'

export type SemaphoreEventStatus =
  | 'BLOCKED'
  | 'SUCCEEDED'

export interface SemaphoreExecutionEvent {
  readonly operation: 'P' | 'V'
  readonly semaphoreName: string
  readonly status: SemaphoreEventStatus
  readonly valueBefore: number
  readonly valueAfter: number
}

export interface LoopConditionExecutionEvent {
  readonly loopType: 'WHILE' | 'REPEAT_UNTIL'
  readonly conditionResult: boolean
  readonly sharedVariableNames: string[]
  readonly bodyIsEmpty: boolean
}

export interface DataStructureExecutionEvent {
  readonly operation:
    | 'ENQUEUE'
    | 'DEQUEUE'
    | 'FRONT'
    | 'PUSH'
    | 'POP'
    | 'TOP'
    | 'IS_EMPTY'
    | 'SIZE'
  readonly structureName: string
  readonly structureKind:
    | 'FIFO_QUEUE'
    | 'PRIORITY_QUEUE'
    | 'STACK'
  readonly scope: 'LOCAL' | 'SHARED'
  readonly sizeBefore: number
  readonly sizeAfter: number
  readonly value?: PrimitiveValue
  readonly priority?: number
}

export interface SimulatedOperationExecutionEvent {
  readonly operationName: string
  readonly arguments: RuntimeValue[]
  readonly receiver?: {
    readonly name: string
    readonly recordType: string
    readonly scope: 'LOCAL' | 'SHARED'
  }
}

export interface ExecutionEvent {
  readonly step: number
  readonly processId: ProcessId
  readonly instructionType: string
  readonly sourceRange?: SourceRange
  readonly description?: string
  readonly awaitStatus?: AwaitEventStatus
  readonly semaphoreEvent?: SemaphoreExecutionEvent
  readonly loopConditionEvent?: LoopConditionExecutionEvent
  readonly dataStructureEvent?: DataStructureExecutionEvent
  readonly simulatedOperationEvent?: SimulatedOperationExecutionEvent
}
