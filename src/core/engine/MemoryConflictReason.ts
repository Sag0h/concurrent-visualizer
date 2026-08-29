export interface MemoryAccessProtection {
  readonly atomicRegion: boolean
  readonly mutexSemaphoreNames: string[]
  readonly ambiguousSemaphoreNames: string[]
}

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
  | {
      readonly type: 'INCONSISTENT_PROTECTION'
      readonly first: MemoryAccessProtection
      readonly second: MemoryAccessProtection
    }
  | {
      readonly type: 'OBSERVED_MUTEX_OVERLAP'
      readonly first: MemoryAccessProtection
      readonly second: MemoryAccessProtection
    }
