import type { Memory } from '../memory/Memory'

export interface MonitorCallFrame {
  readonly monitorName: string
  readonly procedureName: string
  localMemory: Memory
}
