import type { Memory } from '../memory/Memory'
import type { DeclaredType } from '../language/DeclaredType'

export type MonitorCallerMemory =
  | { readonly kind: 'PROCESS' }
  | {
      readonly kind: 'FUNCTION'
      readonly frameIndex: number
    }
  | {
      readonly kind: 'MONITOR'
      readonly frameIndex: number
    }

export type ResolvedMonitorOutputTarget =
  | {
      readonly type: 'VARIABLE'
      readonly name: string
    }
  | {
      readonly type: 'ARRAY_ACCESS'
      readonly arrayName: string
      readonly index: number
    }
  | {
      readonly type: 'RECORD_FIELD'
      readonly recordName: string
      readonly fieldName: string
    }
  | {
      readonly type: 'ARRAY_RECORD_FIELD'
      readonly arrayName: string
      readonly index: number
      readonly fieldName: string
    }

export interface MonitorOutputBinding {
  readonly parameterName: string
  readonly declaredType: DeclaredType
  readonly callerMemory: MonitorCallerMemory
  readonly target: ResolvedMonitorOutputTarget
}

export interface MonitorEntryRequest {
  readonly monitorName: string
  readonly procedureName: string
  readonly parameterMemory: Memory
  readonly outputBindings: MonitorOutputBinding[]
}

export interface MonitorCallFrame {
  readonly monitorName: string
  readonly procedureName: string
  localMemory: Memory
  readonly outputBindings: MonitorOutputBinding[]
}
