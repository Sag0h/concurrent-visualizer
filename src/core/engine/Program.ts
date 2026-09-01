import type { Process } from '../process/Process'
import type { Memory } from '../memory/Memory'
import type { FunctionDefinition } from '../language/FunctionDefinition'
import type { Semaphore } from '../semaphores/Semaphore'
import type { RecordDefinition } from '../language/RecordDefinition'
import type { MonitorDefinition } from '../monitors/MonitorDefinition'

export interface Program {
  readonly processes: Process[]
  sharedMemory: Memory
  readonly functions?: Record<string, FunctionDefinition>
  readonly semaphores?: Record<string, Semaphore>
  readonly recordDefinitions?: Record<string, RecordDefinition>
  readonly monitors?: Record<string, MonitorDefinition>
}
