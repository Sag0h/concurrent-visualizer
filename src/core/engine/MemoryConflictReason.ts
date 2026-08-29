export type MemoryConflictReason =
  | {
      readonly type: 'UNPROTECTED'
    }
  | {
      readonly type: 'ATOMIC_REGION'
    }
  | {
      readonly type: 'SEMAPHORE_MUTEX'
      readonly semaphoreName: string
    }
  | {
      readonly type: 'SEMAPHORE_SIGNALING'
      readonly semaphoreName: string
    }
  | {
      readonly type: 'AMBIGUOUS_SEMAPHORE_PROTOCOL'
      readonly semaphoreNames: string[]
    }
