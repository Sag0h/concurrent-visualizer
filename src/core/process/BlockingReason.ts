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