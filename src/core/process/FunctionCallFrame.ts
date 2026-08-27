import type { Memory } from '../memory/Memory'
import type { RuntimeValue } from '../memory/RuntimeValue'

export interface FunctionCallFrame {
  readonly functionName: string
  readonly localMemory: Memory
  returnValue?: RuntimeValue
  readonly resumesExpression: boolean
}
