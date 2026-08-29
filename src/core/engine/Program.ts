import type { Process } from '../process/Process'
import type { Memory } from '../memory/Memory'
import type { FunctionDefinition } from '../language/FunctionDefinition'
import type { Semaphore } from '../semaphores/Semaphore'

export interface Program {
  readonly processes: Process[]
  sharedMemory: Memory
  readonly functions?: Record<string, FunctionDefinition>
  readonly semaphores?: Record<string, Semaphore>
}