import type { Process } from '../process/Process'
import type { Memory } from '../memory/Memory'
export interface Program {
  readonly processes: Process[]
  sharedMemory: Memory
}
