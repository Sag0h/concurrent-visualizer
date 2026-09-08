import type { Expression } from '../expressions/Expression'

export type BlockingReason =
  | {
      readonly type: 'AWAIT'
      readonly condition: Expression
    }
  | {
      readonly type: 'SEMAPHORE_P'
      readonly semaphoreName: string
    }
  | {
      readonly type: 'MONITOR_ENTRY'
      readonly monitorName: string
    }
  | {
      readonly type: 'MONITOR_CONDITION'
      readonly monitorName: string
      readonly conditionName: string
      readonly phase: 'WAITING' | 'REACQUIRE'
    }
