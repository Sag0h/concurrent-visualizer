import type { ProcessId } from '../process/ProcessId'

export interface EnabledTransition {
  readonly type: 'PROCESS_STEP'
  readonly processId: ProcessId
  readonly resumesBlockedProcess: boolean
  readonly forcedByAtomicity: boolean
}
