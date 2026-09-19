import type { Memory } from '../memory/Memory'
import type { ChannelRuntimeState } from '../channels/ChannelRuntimeState'
import type { ChannelDefinition } from '../channels/ChannelDefinition'

export interface ExpressionContext {
  readonly localMemory: Memory
  readonly sharedMemory: Memory
  readonly channelStates?: Record<string, ChannelRuntimeState>
  readonly channelDefinitions?: Record<string, ChannelDefinition>
}
