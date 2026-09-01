import type { Expression } from '../expressions/Expression'
import type { AssignmentTarget } from '../instructions/AssignmentTarget'
import type {
  MonitorInputArgument,
  MonitorOutputArgument,
  MonitorProcedureArgument,
  MonitorProcedureCall,
} from './MonitorDefinition'

export function monitorInput(
  expression: Expression,
): MonitorInputArgument {
  return {
    mode: 'IN',
    expression,
  }
}

export function monitorOutput(
  target: AssignmentTarget,
): MonitorOutputArgument {
  return {
    mode: 'OUT',
    target,
  }
}

export function monitorProcedureCall(
  monitorName: string,
  procedureName: string,
  args: MonitorProcedureArgument[],
): MonitorProcedureCall {
  return {
    type: 'MONITOR_PROCEDURE_CALL',
    monitorName,
    procedureName,
    arguments: args,
  }
}
