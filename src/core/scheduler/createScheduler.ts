import { FirstReadyScheduler } from './FirstReadyScheduler'
import { RandomScheduler } from './RandomScheduler'
import { RoundRobinScheduler } from './RoundRobinScheduler'
import type { Scheduler } from './Scheduler'
import type { SchedulerType } from './SchedulerType'

export function createScheduler(
  type: SchedulerType,
  seed = 42,
): Scheduler {
  switch (type) {
    case 'FIRST_READY':
      return new FirstReadyScheduler()

    case 'ROUND_ROBIN':
      return new RoundRobinScheduler()

    case 'RANDOM':
      return new RandomScheduler(seed)
  }
}
