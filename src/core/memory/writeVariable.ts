import type { Memory } from './Memory'
import type { RuntimeValue } from './RuntimeValue'

export function writeVariable(
  name: string,
  value: RuntimeValue,
  localMemory: Memory,
  sharedMemory: Memory,
): void {
  if (name in localMemory) {
    localMemory[name] = structuredClone(value)
    return
  }

  if (name in sharedMemory) {
    sharedMemory[name] = structuredClone(value)
    return
  }

  throw new Error(`Variable "${name}" is not defined`)
}
