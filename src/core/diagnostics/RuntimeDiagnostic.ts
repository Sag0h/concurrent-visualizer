import type { ProcessId } from '../process/ProcessId'

export type RuntimeDiagnosticCode =
  | 'BUSY_WAITING_OBSERVED'
  | 'STARVATION_RISK'
  | 'STEP_LIMIT_REACHED'

export type RuntimeDiagnosticSeverity =
  | 'INFO'
  | 'WARNING'

export interface RuntimeDiagnostic {
  readonly code: RuntimeDiagnosticCode
  readonly severity: RuntimeDiagnosticSeverity
  readonly title: string
  readonly summary: string
  readonly detectedAtStep: number
  readonly processIds: ProcessId[]
  readonly evidence: string[]
  readonly scopeNote: string
}
