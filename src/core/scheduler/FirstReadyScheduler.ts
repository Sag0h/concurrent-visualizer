import type { Process } from '../process/Process'
import type { Scheduler } from './Scheduler'

export class FirstReadyScheduler implements Scheduler {
  selectNext(processes: Process[]): Process | undefined {
    return processes.find(
      (process) => process.state === 'READY',
    )
  }
  reset(): void {
    
  }
}
