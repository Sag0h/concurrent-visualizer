import type { PrimitiveType } from '../memory/RuntimeValue'

export type DeclaredValueType =
  | {
      readonly kind: 'PRIMITIVE'
      readonly primitiveType: PrimitiveType
    }
  | {
      readonly kind: 'RECORD'
      readonly recordType: string
    }

export type DeclaredType =
  | {
      readonly container: 'SCALAR'
      readonly valueType: DeclaredValueType
    }
  | {
      readonly container: 'ARRAY'
      readonly elementType: DeclaredValueType
    }
  | {
      readonly container: 'QUEUE'
      readonly elementType: DeclaredValueType
    }
  | {
      readonly container: 'PRIORITY_QUEUE'
      readonly elementType: DeclaredValueType
    }
  | {
      readonly container: 'STACK'
      readonly elementType: DeclaredValueType
    }
