import type { Process } from '../process/Process'

export interface Scheduler {
  selectNext(processes: Process[]): Process | undefined
  reset(): void
}
