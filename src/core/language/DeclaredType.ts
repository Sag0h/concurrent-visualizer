import type { PrimitiveType } from '../memory/RuntimeValue'

export type DeclaredType =
  | {
      readonly container:
        | 'SCALAR'
        | 'ARRAY'
        | 'QUEUE'
        | 'PRIORITY_QUEUE'
        | 'STACK'
      readonly primitiveType: PrimitiveType
    }
  | {
      readonly container: 'RECORD'
      readonly recordType: string
    }
