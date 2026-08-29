import type { ProcessId } from '../process/ProcessId'

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

export interface ExecutionEvent {
  readonly step: number
  readonly processId: ProcessId
  readonly instructionType: string
  readonly description?: string
  readonly awaitStatus?: AwaitEventStatus
  readonly semaphoreEvent?: SemaphoreExecutionEvent
  readonly loopConditionEvent?: LoopConditionExecutionEvent
}
