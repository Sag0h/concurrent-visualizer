import type { ProgramExample } from './ProgramExample'
import { semaphoreExamples } from './semaphoreExamples'

export const programExamples = [
  ...semaphoreExamples,
] as const satisfies readonly ProgramExample[]

export function findProgramExample(
  id: string,
): ProgramExample | undefined {
  return programExamples.find(
    (example) => example.id === id,
  )
}
