import type { Process } from '../process/Process'
import type { Scheduler } from './Scheduler'

export class RoundRobinScheduler implements Scheduler {
  private lastSelectedIndex = -1

  selectNext(processes: Process[]): Process | undefined {
    if (processes.length === 0) {
      return undefined
    }

    for (let offset = 1; offset <= processes.length; offset++) {
      const index =
        (this.lastSelectedIndex + offset) % processes.length

      const process = processes[index]

      if (process.state === 'READY') {
        this.lastSelectedIndex = index
        return process
      }
    }

    return undefined
  }
  reset(): void {
    this.lastSelectedIndex = -1
  }

  clone(): Scheduler {
    const clone = new RoundRobinScheduler()

    clone.lastSelectedIndex =
      this.lastSelectedIndex

    return clone
  }
}
