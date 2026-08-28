export type MicroOperationType =
  | 'INSTRUCTION'
  | 'SHARED_READ'
  | 'COMPUTE'
  | 'SHARED_WRITE'

export interface MicroOperation {
  readonly type: MicroOperationType
  readonly description: string
}