export interface VariableMemoryLocation {
  readonly type: 'VARIABLE'
  readonly name: string
}

export interface ArrayElementMemoryLocation {
  readonly type: 'ARRAY_ELEMENT'
  readonly arrayName: string
  readonly index: number
}

export interface RecordFieldMemoryLocation {
  readonly type: 'RECORD_FIELD'
  readonly recordName: string
  readonly fieldName: string
}

export type MemoryLocation =
  | VariableMemoryLocation
  | ArrayElementMemoryLocation
  | RecordFieldMemoryLocation
