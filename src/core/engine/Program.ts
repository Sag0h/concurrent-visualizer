import type { Process } from '../process/Process'

export interface Program {
  readonly processes: Process[]
}
