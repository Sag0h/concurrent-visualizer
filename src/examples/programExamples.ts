import type { ProgramExample } from './ProgramExample'
import { monitorExamples } from './monitorExamples'
import { messagePassingExamples } from './messagePassingExamples'
import { semaphoreExamples } from './semaphoreExamples'

export const programExamples = [
  ...semaphoreExamples,
  ...monitorExamples,
  ...messagePassingExamples,
] as const satisfies readonly ProgramExample[]

export function findProgramExample(
  id: string,
): ProgramExample | undefined {
  return programExamples.find(
    (example) => example.id === id,
  )
}
