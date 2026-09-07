import type { Memory } from './Memory'
import {
  describeRuntimeType,
  isUninitializedVariableValue,
  type RuntimeValue,
} from './RuntimeValue'
import {
  formatDeclaredType,
  valueMatchesDeclaredType,
} from '../language/DeclaredTypeUtils'

export function writeVariable(
  name: string,
  value: RuntimeValue,
  localMemory: Memory,
  sharedMemory: Memory,
): void {
  if (name in localMemory) {
    const previousValue = localMemory[name]

    if (
      isUninitializedVariableValue(previousValue)
      && !valueMatchesDeclaredType(
        value,
        previousValue.declaredType,
      )
    ) {
      throw new Error(
        `Variable "${name}" requires ${formatDeclaredType(previousValue.declaredType)} but received ${describeRuntimeType(value)}`,
      )
    }

    localMemory[name] = structuredClone(value)
    return
  }

  if (name in sharedMemory) {
    sharedMemory[name] = structuredClone(value)
    return
  }

  throw new Error(`Variable "${name}" is not defined`)
}
