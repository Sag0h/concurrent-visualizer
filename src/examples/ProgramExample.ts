import type { SchedulerType } from '../core/scheduler/SchedulerType'

export type ProgramExampleCategory = 'SEMAPHORES'
export type ProgramExampleVariant = 'PROBLEM' | 'SOLUTION'

export interface ProgramExample {
  readonly id: string
  readonly topicId: string
  readonly title: string
  readonly category: ProgramExampleCategory
  readonly variant: ProgramExampleVariant
  readonly description: string
  readonly source: string
  readonly recommendedScheduler: SchedulerType
}
