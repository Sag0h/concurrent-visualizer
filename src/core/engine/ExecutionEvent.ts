import type { ProcessId } from '../process/ProcessId'
import type { PrimitiveValue } from '../memory/RuntimeValue'

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

export interface QueueExecutionEvent {
  readonly operation:
    | 'ENQUEUE'
    | 'DEQUEUE'
    | 'FRONT'
    | 'IS_EMPTY'
    | 'SIZE'
  readonly queueName: string
  readonly queueKind: 'FIFO' | 'PRIORITY'
  readonly scope: 'LOCAL' | 'SHARED'
  readonly sizeBefore: number
  readonly sizeAfter: number
  readonly value?: PrimitiveValue
  readonly priority?: number
}

export interface ExecutionEvent {
  readonly step: number
  readonly processId: ProcessId
  readonly instructionType: string
  readonly description?: string
  readonly awaitStatus?: AwaitEventStatus
  readonly semaphoreEvent?: SemaphoreExecutionEvent
  readonly loopConditionEvent?: LoopConditionExecutionEvent
  readonly queueEvent?: QueueExecutionEvent
}
