import type { Expression } from '../expressions/Expression'
import type { AssignmentTarget } from '../instructions/AssignmentTarget'
import type { Instruction } from '../instructions/Instruction'
import type { DeclaredType } from '../language/DeclaredType'

export type MonitorProcedureParameterMode = 'IN' | 'OUT'

export interface MonitorProcedureParameter {
  readonly name: string
  readonly mode: MonitorProcedureParameterMode
  readonly declaredType: DeclaredType
}

export interface MonitorStateDeclaration {
  readonly name: string
  readonly declaredType: DeclaredType
  readonly initialValue: Expression
}

export interface MonitorConditionDefinition {
  readonly name: string
}

export interface MonitorProcedureDefinition {
  readonly name: string
  readonly parameters: MonitorProcedureParameter[]
  readonly body: Instruction[]
}

export interface MonitorDefinition {
  readonly name: string
  readonly state: MonitorStateDeclaration[]
  readonly conditions: MonitorConditionDefinition[]
  readonly procedures: Record<string, MonitorProcedureDefinition>
  readonly initializationBody: Instruction[]
}

export interface MonitorInputArgument {
  readonly mode: 'IN'
  readonly expression: Expression
}

export interface MonitorOutputArgument {
  readonly mode: 'OUT'
  readonly target: AssignmentTarget
}

export type MonitorProcedureArgument =
  | MonitorInputArgument
  | MonitorOutputArgument

/**
 * Parsed representation of `monitor.procedure(...)`.
 * It becomes an executable Instruction only when M12 adds runtime support.
 */
export interface MonitorProcedureCall {
  readonly type: 'MONITOR_PROCEDURE_CALL'
  readonly monitorName: string
  readonly procedureName: string
  readonly arguments: MonitorProcedureArgument[]
}
