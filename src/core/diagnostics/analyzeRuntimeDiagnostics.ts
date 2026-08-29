import type { ExecutionState } from '../engine/ExecutionState'
import type { ExecutionEvent } from '../engine/ExecutionEvent'
import type { Process } from '../process/Process'
import type { RuntimeDiagnostic } from './RuntimeDiagnostic'

export const BUSY_WAITING_OBSERVATION_THRESHOLD = 4
export const STARVATION_STEP_THRESHOLD = 12

export interface RuntimeDiagnosticOptions {
  readonly stepLimitReached: boolean
  readonly maxSteps: number
}

export function analyzeRuntimeDiagnostics(
  state: ExecutionState,
  options: RuntimeDiagnosticOptions,
): RuntimeDiagnostic[] {
  const diagnostics: RuntimeDiagnostic[] = []

  if (options.stepLimitReached && !allProcessesFinished(state)) {
    diagnostics.push(createStepLimitDiagnostic(state, options.maxSteps))
  }

  diagnostics.push(...findBusyWaitingDiagnostics(state))
  diagnostics.push(...findStarvationRiskDiagnostics(state))

  return diagnostics
}

function createStepLimitDiagnostic(
  state: ExecutionState,
  maxSteps: number,
): RuntimeDiagnostic {
  const unfinishedProcessIds = state.program.processes
    .filter((process) => process.state !== 'FINISHED')
    .map((process) => process.id)

  return {
    code: 'STEP_LIMIT_REACHED',
    severity: 'INFO',
    title: 'Step limit reached',
    summary:
      `Execution stopped after ${maxSteps} steps without finishing. `
      + 'This is not a deadlock: at least one process can still run.',
    detectedAtStep: state.stepCount,
    processIds: unfinishedProcessIds,
    evidence: [
      `${unfinishedProcessIds.length} process(es) remain unfinished.`,
      'The simulator stopped at its safety limit instead of waiting indefinitely.',
    ],
    scopeNote:
      'A finite trace cannot decide whether non-termination is intentional or a bug.',
  }
}

function findBusyWaitingDiagnostics(
  state: ExecutionState,
): RuntimeDiagnostic[] {
  return state.program.processes.flatMap((process) => {
    if (process.state !== 'READY') {
      return []
    }

    const processHistory = state.history.filter(
      (event) => event.processId === process.id,
    )
    const lastEvent = processHistory.at(-1)
    const observation = lastEvent?.loopConditionEvent

    if (
      !observation
      || !observation.bodyIsEmpty
      || observation.sharedVariableNames.length === 0
      || !keepsLoopRunning(observation.loopType, observation.conditionResult)
    ) {
      return []
    }

    const matchingTail = countMatchingLoopTail(
      processHistory,
      lastEvent,
    )

    if (matchingTail < BUSY_WAITING_OBSERVATION_THRESHOLD) {
      return []
    }

    const sharedVariables = observation.sharedVariableNames.join(', ')

    return [{
      code: 'BUSY_WAITING_OBSERVED',
      severity: 'WARNING',
      title: 'Busy waiting observed',
      summary:
        `${process.id} repeatedly polls shared state (${sharedVariables}) `
        + 'in an empty loop without becoming BLOCKED.',
      detectedAtStep: state.stepCount,
      processIds: [process.id],
      evidence: [
        `${matchingTail} consecutive evaluations keep the loop running.`,
        'The loop body is empty and its condition reads shared memory.',
        `${process.id} remains READY, so it continues consuming scheduler steps.`,
      ],
      scopeNote:
        'Only repeated empty polling loops are identified; more complex loops are left unclassified.',
    } satisfies RuntimeDiagnostic]
  })
}

function countMatchingLoopTail(
  processHistory: ExecutionEvent[],
  referenceEvent: ExecutionEvent,
): number {
  const reference = referenceEvent.loopConditionEvent

  if (!reference) {
    return 0
  }

  let count = 0

  for (let index = processHistory.length - 1; index >= 0; index--) {
    const candidate = processHistory[index].loopConditionEvent

    if (
      !candidate
      || candidate.loopType !== reference.loopType
      || candidate.bodyIsEmpty !== reference.bodyIsEmpty
      || candidate.conditionResult !== reference.conditionResult
      || candidate.sharedVariableNames.join('\0')
        !== reference.sharedVariableNames.join('\0')
    ) {
      break
    }

    count++
  }

  return count
}

function keepsLoopRunning(
  loopType: 'WHILE' | 'REPEAT_UNTIL',
  conditionResult: boolean,
): boolean {
  return loopType === 'WHILE'
    ? conditionResult
    : !conditionResult
}

function findStarvationRiskDiagnostics(
  state: ExecutionState,
): RuntimeDiagnostic[] {
  if (state.stepCount < STARVATION_STEP_THRESHOLD) {
    return []
  }

  return state.program.processes.flatMap((process) => {
    if (process.state !== 'READY') {
      return []
    }

    const lastExecutionStep = findLastExecutionStep(
      state.history,
      process,
    )
    const stepsWithoutSelection = state.stepCount - lastExecutionStep

    if (stepsWithoutSelection < STARVATION_STEP_THRESHOLD) {
      return []
    }

    const otherProcessExecutions = state.history.filter(
      (event) =>
        event.step > lastExecutionStep
        && event.processId !== process.id,
    ).length

    if (otherProcessExecutions < STARVATION_STEP_THRESHOLD) {
      return []
    }

    return [{
      code: 'STARVATION_RISK',
      severity: 'WARNING',
      title: 'Starvation risk',
      summary:
        `${process.id} is READY but has not been selected for `
        + `${stepsWithoutSelection} steps while other processes keep running.`,
      detectedAtStep: state.stepCount,
      processIds: [process.id],
      evidence: [
        `${process.id}'s last execution was at step ${lastExecutionStep}.`,
        `${otherProcessExecutions} later step(s) belong to other processes.`,
      ],
      scopeNote:
        'This finite trace shows prolonged postponement, not proof that the process can never run.',
    } satisfies RuntimeDiagnostic]
  })
}

function findLastExecutionStep(
  history: ExecutionEvent[],
  process: Process,
): number {
  for (let index = history.length - 1; index >= 0; index--) {
    if (history[index].processId === process.id) {
      return history[index].step
    }
  }

  return 0
}

function allProcessesFinished(state: ExecutionState): boolean {
  return state.program.processes.every(
    (process) => process.state === 'FINISHED',
  )
}
