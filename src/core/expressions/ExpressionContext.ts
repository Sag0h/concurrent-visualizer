import type { Memory } from '../memory/Memory'

export interface ExpressionContext {
  readonly localMemory: Memory
  readonly sharedMemory: Memory
}
