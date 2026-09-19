import type { RuntimeValue } from '../memory/RuntimeValue'

export interface MessageEnvelope {
  readonly values: RuntimeValue[]
}

export interface ChannelRuntimeState {
  messages: MessageEnvelope[]
}
