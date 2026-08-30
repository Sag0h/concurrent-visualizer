import type { PrimitiveType } from '../memory/RuntimeValue'

export interface RecordFieldDefinition {
  readonly name: string
  readonly type: PrimitiveType
}

export interface RecordDefinition {
  readonly name: string
  readonly fields: RecordFieldDefinition[]
}
