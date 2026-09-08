import type { DeclaredValueType } from '../language/DeclaredType'

export interface ChannelDefinition {
  readonly name: string
  readonly payloadTypes: DeclaredValueType[]
  readonly arrayLength?: number
}
