import type { ProcessId } from '../process/ProcessId'

export interface ExecutionEvent {
  readonly step: number
  readonly processId: ProcessId
  readonly instructionType: string
}
