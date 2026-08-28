import type { ProcessId } from '../process/ProcessId'
import type { MicroOperationType } from './MicroOperation'

export interface MicroOperationEvent {
  readonly step: number
  readonly processId: ProcessId
  readonly type: MicroOperationType
  readonly description: string
}