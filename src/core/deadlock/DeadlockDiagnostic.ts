import type { ProcessId } from '../process/ProcessId'

export type ProgramExecutionStatus =
  | 'RUNNING'
  | 'TEMPORARILY_BLOCKED'
  | 'FINISHED'
  | 'DEADLOCK'
  | 'STEP_LIMIT_REACHED'

export type DeadlockKind =
  | 'CIRCULAR_WAIT'
  | 'TERMINAL_BLOCKING'

export type SynchronizationResourceKind =
  | 'SEMAPHORE'
  | 'MONITOR'
  | 'CHANNEL'

export interface WaitForResource {
  readonly id: string
  readonly kind: SynchronizationResourceKind
  readonly name: string
}

export interface ResourceDependency {
  readonly type: 'WAITS_FOR' | 'HOLDS'
  readonly processId: ProcessId
  readonly resourceId: string
}

export interface WaitForEdge {
  readonly waitingProcessId: ProcessId
  readonly holdingProcessId: ProcessId
  readonly resourceId: string
}

export interface DeadlockCycle {
  readonly processIds: ProcessId[]
  readonly resourceIds: string[]
}

export interface DeadlockDiagnostic {
  readonly kind: DeadlockKind
  readonly detectedAtStep: number
  readonly summary: string
  readonly blockedProcessIds: ProcessId[]
  readonly involvedProcessIds: ProcessId[]
  readonly involvedResources: WaitForResource[]
  readonly resourceDependencies: ResourceDependency[]
  readonly waitForEdges: WaitForEdge[]
  readonly cycles: DeadlockCycle[]
  readonly graphIsComplete: boolean
  readonly replayTargetStep: number
}

export interface ExecutionDiagnostic {
  readonly status: ProgramExecutionStatus
  readonly deadlock?: DeadlockDiagnostic
}
