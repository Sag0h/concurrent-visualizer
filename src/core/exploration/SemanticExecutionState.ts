import type { ExecutionState } from '../engine/ExecutionState'
import type { Program } from '../engine/Program'
import type { MonitorRuntimeState } from '../monitors/MonitorRuntimeState'
import type { ChannelRuntimeState } from '../channels/ChannelRuntimeState'

export interface SemanticExecutionState {
  readonly program: Program
  readonly monitorStates: Record<string, MonitorRuntimeState>
  readonly channelStates: Record<string, ChannelRuntimeState>
}

export function projectSemanticExecutionState(
  state: ExecutionState,
): SemanticExecutionState {
  return {
    program: structuredClone(state.program),
    monitorStates: structuredClone(state.monitorStates ?? {}),
    channelStates: structuredClone(state.channelStates),
  }
}
