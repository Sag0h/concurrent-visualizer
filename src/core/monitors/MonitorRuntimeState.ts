import type { Memory } from '../memory/Memory'

export interface MonitorConditionState {
  /** FIFO: the oldest waiter is stored at index 0. */
  readonly waitingProcessIds: string[]
}

export interface MonitorRuntimeState {
  readonly definitionName: string
  memory: Memory
  initialized: boolean
  ownerProcessId?: string
  /** Membership is relevant; array order does not grant admission priority. */
  readonly entryContenderProcessIds: string[]
  readonly conditions: Record<string, MonitorConditionState>
}
