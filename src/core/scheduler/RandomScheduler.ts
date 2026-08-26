import type { Process } from '../process/Process'
import type { Scheduler } from './Scheduler'
import { SeededRandom } from './SeededRandom'

export class RandomScheduler implements Scheduler {
  private readonly random: SeededRandom

  constructor(seed: number) {
    this.random = new SeededRandom(seed)
  }

  selectNext(processes: Process[]): Process | undefined {
    const readyProcesses = processes.filter(
      (process) => process.state === 'READY',
    )

    if (readyProcesses.length === 0) {
      return undefined
    }

    const index = Math.floor(
      this.random.next() * readyProcesses.length,
    )

    return readyProcesses[index]
  }
}
