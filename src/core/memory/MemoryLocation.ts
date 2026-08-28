export interface VariableMemoryLocation {
  readonly type: 'VARIABLE'
  readonly name: string
}

export interface ArrayElementMemoryLocation {
  readonly type: 'ARRAY_ELEMENT'
  readonly arrayName: string
  readonly index: number
}

export type MemoryLocation =
  | VariableMemoryLocation
  | ArrayElementMemoryLocation
