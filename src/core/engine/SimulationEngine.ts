import type { ExecutionState } from './ExecutionState'
import type { Scheduler } from '../scheduler/Scheduler'
import { evaluateExpression } from '../expressions/evaluateExpression'
import { writeVariable } from '../memory/writeVariable'
import type { SimulationSnapshot } from './SimulationSnapshot'
import type { Process } from '../process/Process'
import type { CallInstruction, DataStructureOperationInstruction, ForeachInstruction, IfInstruction, Instruction, WhileInstruction } from '../instructions/Instruction'
import type { ExecutionFrame } from '../process/ExecutionFrame'
import {
  assertPriority,
  assertArrayElementCompatible,
  assertCollectionElementType,
  enqueuePriorityItem,
  isDataStructureValue,
  isRecordValue,
  resolveRecordGetterFieldName,
  isPriorityQueueValue,
  isPrimitiveValue,
  isStackValue,
  createUninitializedOutValue,
  createUninitializedVariableValue,
  isUninitializedOutValue,
  isUninitializedVariableValue,
  describeRuntimeType,
  type PriorityQueueValue,
  type CollectionElementValue,
  type QueueValue,
  type RuntimeValue,
  type StackValue,
} from '../memory/RuntimeValue'
import type { PendingInstruction } from '../process/PendingInstruction'

import type {
  Expression,
  FunctionCallExpression,
} from '../expressions/Expression'
import type { AssignmentTarget } from '../instructions/AssignmentTarget'
import type { FunctionDefinition } from '../language/FunctionDefinition'
import type {
  DeclaredType,
  DeclaredValueType,
} from '../language/DeclaredType'
import type { MonitorRuntimeState } from '../monitors/MonitorRuntimeState'
import type {
  MonitorCallerMemory,
  MonitorEntryRequest,
  MonitorOutputBinding,
  ResolvedMonitorOutputTarget,
} from '../monitors/MonitorCallFrame'
import {
  declaredTypesEqual,
  formatDeclaredType,
  valueMatchesDeclaredType,
} from '../language/DeclaredTypeUtils'
import type { PendingEvaluation } from '../process/PendingEvaluation'
import type { SharedMemoryRead } from '../expressions/SharedMemoryExpression'
import type { MemoryLocation } from '../memory/MemoryLocation'
import { findMemoryAccessConflicts } from './findMemoryAccessConflicts'
import { summarizeMemoryAccessConflicts } from './summarizeMemoryAccessConflicts'
import type {
  ExecutionEvent,
  LoopConditionExecutionEvent,
  DataStructureExecutionEvent,
  SemaphoreExecutionEvent,
  MonitorConditionExecutionEvent,
  SimulatedOperationExecutionEvent,
} from './ExecutionEvent'
import { analyzeDeadlock } from '../deadlock/analyzeDeadlock'
import type { ExecutionDiagnostic } from '../deadlock/DeadlockDiagnostic'
import { analyzeRuntimeDiagnostics } from '../diagnostics/analyzeRuntimeDiagnostics'
import type { EnabledTransition } from './EnabledTransition'
import { cloneExecutionState } from './cloneExecutionState'
import {
  reconstructExecutionAnalysisState,
  recordExecutionAnalysisEvent,
  recordMicroOperationAnalysisEvent,
} from './ExecutionAnalysisState'

export class SimulationEngine {
  private state: ExecutionState
  private scheduler: Scheduler
  private readonly initialState: ExecutionState
  private readonly maxSteps: number

  constructor(
    state: ExecutionState,
    scheduler: Scheduler,
    maxSteps: number = 10_000,
  ) {
    this.state = state
    this.state.analysisState ??=
      reconstructExecutionAnalysisState(this.state)
    this.scheduler = scheduler
    this.initialState = cloneExecutionState(state)
    this.maxSteps = maxSteps
  }

  getState(): ExecutionState {
    return this.state
  }

  isFinished(): boolean {
    return this.state.program.processes.every(
      (process) => process.state === 'FINISHED',
    )
  }

  getExecutionDiagnostic(): ExecutionDiagnostic {
    const diagnostic = analyzeDeadlock(this.state)

    if (
      this.hasReachedStepLimit()
      && diagnostic.status !== 'FINISHED'
      && diagnostic.status !== 'DEADLOCK'
    ) {
      return { status: 'STEP_LIMIT_REACHED' }
    }

    return diagnostic
  }

  isDeadlocked(): boolean {
    return this.getExecutionDiagnostic().status
      === 'DEADLOCK'
  }

  reset(): void {
    this.state = cloneExecutionState(
      this.initialState,
    )
    this.scheduler.reset()
  }

  stepBack(): boolean {
    if (this.state.stepCount === 0) {
      return false
    }

    this.rewindToStep(
      this.state.stepCount - 1,
    )

    return true
  }

  rewindToStep(targetStep: number): void {
    if (!Number.isInteger(targetStep)) {
      throw new Error(
        'Rewind target step must be an integer',
      )
    }

    if (
      targetStep < 0
      || targetStep > this.state.stepCount
    ) {
      throw new Error(
        `Cannot rewind from step ${this.state.stepCount} to step ${targetStep}`,
      )
    }

    if (targetStep === this.state.stepCount) {
      return
    }

    const expectedTrace = this.state.history
      .slice(0, targetStep)
    const replayScheduler = this.scheduler.clone()

    replayScheduler.reset()

    const replayEngine = new SimulationEngine(
      cloneExecutionState(this.initialState),
      replayScheduler,
      this.maxSteps,
    )

    for (const expectedEvent of expectedTrace) {
      const progressed = replayEngine.step()
      const actualEvent = replayEngine
        .getState()
        .history[
          replayEngine.getState().history.length - 1
        ]

      if (
        !progressed
        || !actualEvent
        || actualEvent.processId
          !== expectedEvent.processId
        || actualEvent.instructionType
          !== expectedEvent.instructionType
      ) {
        throw new Error(
          `Cannot reproduce execution trace at step ${expectedEvent.step}`,
        )
      }
    }

    this.state = cloneExecutionState(
      replayEngine.state,
    )
    this.scheduler =
      replayEngine.scheduler.clone()
  }

  fork(): SimulationEngine {
    return new SimulationEngine(
      cloneExecutionState(this.state),
      this.scheduler.clone(),
      this.maxSteps,
    )
  }

  hasReachedStepLimit(): boolean {
    return this.state.stepCount >= this.maxSteps
  }

  step(): boolean {
    if (this.state.stepCount >= this.maxSteps) {
      return false
    }

    this.reevaluateBlockedProcesses()

    const atomicProcess =
      this.findActiveAtomicProcess()

    const process =
      atomicProcess
      ?? this.scheduler.selectNext(
        this.state.program.processes,
      )

    if (!process) {
      return false
    }

    return this.executeProcessStep(process)
  }

  getEnabledTransitions(): EnabledTransition[] {
    if (this.hasReachedStepLimit()) {
      return []
    }

    const enabledProcesses =
      this.state.program.processes.filter(
        (process) =>
          this.isProcessLogicallyEnabled(process),
      )

    const atomicProcess = enabledProcesses.find(
      (process) => process.atomicDepth > 0,
    )
    const selectableProcesses = atomicProcess
      ? [atomicProcess]
      : enabledProcesses

    return selectableProcesses.map((process) => ({
      type: 'PROCESS_STEP',
      processId: process.id,
      resumesBlockedProcess:
        process.state === 'BLOCKED',
      forcedByAtomicity:
        process.atomicDepth > 0,
    }))
  }

  stepTransition(
    transition: EnabledTransition,
  ): boolean {
    if (this.hasReachedStepLimit()) {
      return false
    }

    const enabledTransition =
      this.getEnabledTransitions().find(
        (candidate) =>
          candidate.type === transition.type
          && candidate.processId
            === transition.processId,
      )

    if (!enabledTransition) {
      throw new Error(
        `Transition for process "${transition.processId}" is not enabled`,
      )
    }

    this.reevaluateBlockedProcesses()

    const process =
      this.state.program.processes.find(
        (candidate) =>
          candidate.id === transition.processId,
      )

    if (!process || process.state !== 'READY') {
      throw new Error(
        `Process "${transition.processId}" cannot execute the selected transition`,
      )
    }

    return this.executeProcessStep(process)
  }

  private executeProcessStep(
    process: Process,
  ): boolean {
  process.state = 'RUNNING'

  try {
    const instruction =
      this.getCurrentInstruction(process)

    if (!instruction) {
      process.state = 'FINISHED'
      return true
    }

    let executionDescription:
      string | undefined

    let awaitStatus:
      'BLOCKED' | 'ENABLED' | undefined

    let semaphoreEvent:
      SemaphoreExecutionEvent | undefined

    let monitorConditionEvent:
      MonitorConditionExecutionEvent | undefined

    let loopConditionEvent:
      LoopConditionExecutionEvent | undefined

    let dataStructureEvent:
      DataStructureExecutionEvent | undefined

    let simulatedOperationEvent:
      SimulatedOperationExecutionEvent | undefined

    if (this.hasPendingFunctionArgumentEvaluation(process)) {
      this.continuePendingFunctionArguments(process)
      executionDescription =
        'Evaluated a pending function argument'
    } else switch (instruction.type) {
      case 'NO_OP':
        this.advanceProcess(process)
        break

      case 'FINISH':
        process.programCounter++
        process.state = 'FINISHED'

        this.state.history.push({
          step: this.state.stepCount + 1,
          processId: process.id,
          instructionType: instruction.type,
        })

        this.state.stepCount++

        return true

      case 'ASSIGN': {
        if (
          process.microOperationRuntime?.type
            === 'SHARED_ASSIGNMENT'
          || (
            !this.containsFunctionCall(
              instruction.expression,
            )
            && (
              process.microOperationRuntime
              || this.isSharedAssignmentTarget(
                process,
                instruction.target,
              )
              || this.findNextSharedMemoryRead(
                process,
                instruction.expression,
              )
            )
          )
        ) {
          this.executeAssignmentMicroOperation(
            process,
            instruction,
          )

          break
        }

        if (
          this.containsFunctionCall(
            instruction.expression,
          )
        ) {
          this.suspendExpression(
            process,
            instruction.expression,
            {
              type: 'ASSIGN',
              target: instruction.target,
            },
          )

          break
        }

        const value = evaluateExpression(
          instruction.expression,
          {
            localMemory:
              this.getActiveLocalMemory(process),
            sharedMemory:
              this.state.program.sharedMemory,
          },
        )

        this.completeAssignmentValue(
          process,
          instruction.target,
          value,
        )

        break
      }

      case 'DECLARE': {
        if (!instruction.initialValue) {
          if (instruction.scope !== 'LOCAL') {
            throw new Error(
              'Shared variables require an initial value',
            )
          }

          this.getActiveLocalMemory(process)[instruction.name] =
            createUninitializedVariableValue(
              instruction.name,
              instruction.declaredType,
            )
          this.advanceProcess(process)
          break
        }

        if (
          this.containsFunctionCall(
            instruction.initialValue,
          )
        ) {
          this.suspendExpression(
            process,
            instruction.initialValue,
            {
              type: 'DECLARE',
              name: instruction.name,
              scope: instruction.scope,
              declaredType: instruction.declaredType,
            },
          )

          break
        }

        const value = evaluateExpression(
          instruction.initialValue,
          {
            localMemory:
              this.getActiveLocalMemory(process),
            sharedMemory:
              this.state.program.sharedMemory,
          },
        )

        this.assertDeclarationValue(
          instruction.name,
          instruction.declaredType,
          value,
        )

        if (instruction.scope === 'LOCAL') {
          this.getActiveLocalMemory(process)[
            instruction.name
          ] = structuredClone(value)
        } else {
          this.state.program.sharedMemory[
            instruction.name
          ] = structuredClone(value)
        }

        this.advanceProcess(process)
        break
      }

      case 'IF': {
        if (
          this.containsFunctionCall(
            instruction.condition,
          )
        ) {
          this.suspendExpression(
            process,
            instruction.condition,
            {
              type: 'IF',
              instruction,
            },
          )

          break
        }

        const condition = evaluateExpression(
          instruction.condition,
          {
            localMemory:
              this.getActiveLocalMemory(process),
            sharedMemory:
              this.state.program.sharedMemory,
          },
        )

        this.applyIfCondition(
          process,
          instruction,
          condition,
        )

        break
      }

      case 'WHILE': {
        if (
          this.containsFunctionCall(
            instruction.condition,
          )
        ) {
          this.suspendExpression(
            process,
            instruction.condition,
            {
              type: 'WHILE',
              instruction,
            },
          )

          break
        }

        const condition = evaluateExpression(
          instruction.condition,
          {
            localMemory:
              this.getActiveLocalMemory(process),
            sharedMemory:
              this.state.program.sharedMemory,
          },
        )

        if (typeof condition === 'boolean') {
          loopConditionEvent = {
            loopType: 'WHILE',
            conditionResult: condition,
            sharedVariableNames:
              this.findSharedVariableReferences(
                process,
                instruction.condition,
              ),
            bodyIsEmpty:
              instruction.body.length === 0,
          }
        }

        this.applyWhileCondition(
          process,
          instruction,
          condition,
        )

        break
      }

      case 'REPEAT_UNTIL': {
        if (instruction.body.length === 0) {
          if (
            this.containsFunctionCall(
              instruction.condition,
            )
          ) {
            this.suspendExpression(
              process,
              instruction.condition,
              {
                type: 'REPEAT_UNTIL',
                instruction,
              },
            )

            break
          }

          const condition = evaluateExpression(
            instruction.condition,
            {
              localMemory:
                this.getActiveLocalMemory(process),
              sharedMemory:
                this.state.program.sharedMemory,
            },
          )

          if (typeof condition === 'boolean') {
            loopConditionEvent = {
              loopType: 'REPEAT_UNTIL',
              conditionResult: condition,
              sharedVariableNames:
                this.findSharedVariableReferences(
                  process,
                  instruction.condition,
                ),
              bodyIsEmpty: true,
            }
          }

          this.applyRepeatUntilCondition(
            process,
            condition,
          )

          break
        }

        process.executionStack.push({
          instructions: instruction.body,
          programCounter: 0,
          completionMode:
            'CHECK_REPEAT_UNTIL',
          repeatCondition:
            instruction.condition,
        })

        break
      }

      case 'FOREACH': {
        if (
          this.containsFunctionCall(
            instruction.collection,
          )
        ) {
          this.suspendExpression(
            process,
            instruction.collection,
            {
              type: 'FOREACH_COLLECTION',
              instruction,
            },
          )

          break
        }

        const collection = evaluateExpression(
          instruction.collection,
          {
            localMemory:
              this.getActiveLocalMemory(process),
            sharedMemory:
              this.state.program.sharedMemory,
          },
        )

        this.applyForeachCollection(
          process,
          instruction,
          collection,
        )

        break
      }

      case 'FOR': {
        process.executionStack.push({
          instructions: [
            instruction.initializer,
          ],
          programCounter: 0,
          completionMode: 'FOR_CHECK',
          forLoop: {
            condition: instruction.condition,
            body: instruction.body,
            increment:
              instruction.increment,
          },
        })

        break
      }

      case 'BREAK':
        this.breakLoop(process)
        break

      case 'CONTINUE':
        this.continueLoop(process)
        break

      case 'CALL': {
        const functionArgumentIndex =
          instruction.arguments.findIndex(
            (argument) =>
              this.containsFunctionCall(argument),
          )

        if (functionArgumentIndex !== -1) {
         this.suspendExpression(
            process,
            instruction.arguments[
              functionArgumentIndex
            ],
            {
              type: 'CALL_ARGUMENTS',
              instruction,
              argumentIndex:
                functionArgumentIndex,
            },
          )

          break
        }

        this.executeCallInstruction(
          process,
          instruction,
        )

        break
      }

      case 'RETURN': {
        if (
          instruction.value
          && this.containsFunctionCall(
            instruction.value,
          )
        ) {
          this.suspendExpression(
            process,
            instruction.value,
            {
              type: 'RETURN',
              instruction,
            },
          )

          break
        }

        this.executeReturn(
          process,
          instruction.value,
        )

        break
      }

      case 'ATOMIC': {
        if (instruction.body.length === 0) {
          this.advanceProcess(process)
          break
        }

        process.atomicDepth += 1

        process.executionStack.push({
          instructions: instruction.body,
          programCounter: 0,
          completionMode: 'EXIT_ATOMIC',
        })

        break
      }

      case 'AWAIT': {
        if (process.atomicDepth > 0) {
          throw new Error(
            'AWAIT inside an atomic region is not supported yet',
          )
        }

        const enabled =
          this.evaluateAwaitCondition(
            process,
            instruction.condition,
          )

        if (!enabled) {
          process.state = 'BLOCKED'

          process.blockingReason = {
            type: 'AWAIT',
            condition: structuredClone(
              instruction.condition,
            ),
          }

          awaitStatus = 'BLOCKED'
          executionDescription =
            'Await condition evaluated to false'

          break
        }

        process.blockingReason = undefined

        awaitStatus = 'ENABLED'
        executionDescription =
          'Await condition evaluated to true'

        if (instruction.body.length === 0) {
          this.advanceProcess(process)
          break
        }

        process.atomicDepth += 1

        process.executionStack.push({
          instructions: instruction.body,
          programCounter: 0,
          completionMode: 'EXIT_ATOMIC',
        })

        break
      }

      case 'SEMAPHORE_P': {
        const semaphoreName =
          process.blockingReason?.type === 'SEMAPHORE_P'
            ? process.blockingReason.semaphoreName
            : this.resolveSemaphoreName(
                process,
                instruction,
              )
        const semaphore =
          this.getSemaphore(
            semaphoreName,
          )

        if (semaphore.value === 0) {
          process.state = 'BLOCKED'

          process.blockingReason = {
            type: 'SEMAPHORE_P',
            semaphoreName,
          }

          executionDescription =
            `P(${semaphoreName}) blocked: semaphore value is 0`

          semaphoreEvent = {
            operation: 'P',
            semaphoreName,
            status: 'BLOCKED',
            valueBefore: semaphore.value,
            valueAfter: semaphore.value,
          }

          break
        }

        const previousValue = semaphore.value

        semaphore.value -= 1

        process.blockingReason = undefined

        executionDescription =
          `P(${semaphoreName}): ${previousValue} -> ${semaphore.value}`

        semaphoreEvent = {
          operation: 'P',
          semaphoreName,
          status: 'SUCCEEDED',
          valueBefore: previousValue,
          valueAfter: semaphore.value,
        }

        this.advanceProcess(process)

        break
      }

      case 'SEMAPHORE_V': {
        const semaphoreName =
          this.resolveSemaphoreName(
            process,
            instruction,
          )
        const semaphore =
          this.getSemaphore(
            semaphoreName,
          )

        const previousValue = semaphore.value

        semaphore.value += 1

        executionDescription =
          `V(${semaphoreName}): ${previousValue} -> ${semaphore.value}`

        semaphoreEvent = {
          operation: 'V',
          semaphoreName,
          status: 'SUCCEEDED',
          valueBefore: previousValue,
          valueAfter: semaphore.value,
        }

        this.advanceProcess(process)

        break
      }

      case 'MONITOR_WAIT': {
        const result = this.executeMonitorWait(
          process,
          instruction.conditionName,
        )

        monitorConditionEvent = result.event
        executionDescription = result.description
        break
      }

      case 'MONITOR_SIGNAL':
      case 'MONITOR_SIGNAL_ALL': {
        const result = this.executeMonitorSignal(
          process,
          instruction.conditionName,
          instruction.type === 'MONITOR_SIGNAL_ALL',
        )

        monitorConditionEvent = result.event
        executionDescription = result.description
        break
      }

      case 'DATA_STRUCTURE_OPERATION': {
        const result =
          this.executeDataStructureOperation(
            process,
            instruction,
          )

        dataStructureEvent = result.event
        executionDescription =
          result.description

        break
      }

      case 'SIMULATED_OPERATION': {
        const result =
          this.executeSimulatedOperation(
            process,
            instruction,
          )

        simulatedOperationEvent = result.event
        executionDescription = result.description
        break
      }

      case 'MONITOR_PROCEDURE_CALL': {
        const result = this.executeMonitorProcedureCall(
          process,
          instruction,
        )
        executionDescription = result.description
        break
      }

    }

    if (process.state !== 'BLOCKED') {
      this.syncActiveMonitorState(process)
    }

    const executionEvent: ExecutionEvent = {
      step: this.state.stepCount + 1,
      processId: process.id,
      instructionType: instruction.type,
      ...(instruction.sourceRange
        ? {
            sourceRange: structuredClone(
              instruction.sourceRange,
            ),
          }
        : {}),
      awaitStatus,
      semaphoreEvent,
      monitorConditionEvent,
      loopConditionEvent,
      dataStructureEvent,
      simulatedOperationEvent,
      description: executionDescription,
    }

    this.state.history.push(executionEvent)
    recordExecutionAnalysisEvent(
      this.getAnalysisState(),
      executionEvent,
    )

    this.state.stepCount++

    if (process.state !== 'BLOCKED') {
      if (
        process.executionStack.length === 0
        && process.programCounter
          >= process.instructions.length
      ) {
        process.state = 'FINISHED'
      } else {
        process.state = 'READY'
      }
    }

    return true
  } catch (error) {
    process.state = 'READY'
    throw error
  }
}

  getSnapshot(): SimulationSnapshot {
    const executionDiagnostic =
      this.getExecutionDiagnostic()
    const memoryAnalysis =
      this.getAnalysisState().memory

    const memoryAccessConflicts =
      findMemoryAccessConflicts(
        memoryAnalysis.memoryAccessEvents,
        {
          executionHistory:
            memoryAnalysis.semaphoreEvents,
          initialSemaphoreValues:
            memoryAnalysis.initialSemaphoreValues,
        },
      )
    const latestExecutionEvent =
      this.state.history[
        this.state.history.length - 1
      ]
    const microOperationHistory =
      this.state.microOperationHistory ?? []
    const latestMicroOperation =
      microOperationHistory[
        microOperationHistory.length - 1
      ]

    return {
      stepCount: this.state.stepCount,
      executionStatus: executionDiagnostic.status,
      executionFocus: latestExecutionEvent
        ? {
            step: latestExecutionEvent.step,
            processId:
              latestExecutionEvent.processId,
            instructionType:
              latestExecutionEvent.instructionType,
            ...(latestExecutionEvent.sourceRange
              ? {
                  sourceRange: structuredClone(
                    latestExecutionEvent.sourceRange,
                  ),
                }
              : {}),
            description:
              latestExecutionEvent.description,
            microOperation:
              latestMicroOperation?.step
                === latestExecutionEvent.step
                ? structuredClone(
                    latestMicroOperation,
                  )
                : undefined,
          }
        : undefined,
      deadlock: executionDiagnostic.deadlock,
      runtimeDiagnostics:
        analyzeRuntimeDiagnostics(this.state, {
          stepLimitReached:
            executionDiagnostic.status
              === 'STEP_LIMIT_REACHED',
          maxSteps: this.maxSteps,
        }),

      sharedMemory: structuredClone(
        this.state.program.sharedMemory,
      ),
      semaphores: Object.values(
        this.state.program.semaphores ?? {},
      ).map((semaphore) => ({
        name: semaphore.name,
        value: semaphore.value,
        waitingProcessIds:
          this.state.program.processes
            .filter(
              (process) =>
                process.state === 'BLOCKED'
                && process.blockingReason?.type
                  === 'SEMAPHORE_P'
                && process.blockingReason.semaphoreName
                  === semaphore.name,
            )
            .map((process) => process.id),
      })),
      monitors: Object.entries(
        this.state.monitorStates ?? {},
      ).map(([name, monitor]) => ({
        name,
        memory: structuredClone(monitor.memory),
        ownerProcessId: monitor.ownerProcessId,
        entryContenderProcessIds: structuredClone(
          monitor.entryContenderProcessIds,
        ),
        conditions: Object.entries(monitor.conditions).map(
          ([conditionName, condition]) => ({
            name: conditionName,
            waitingProcessIds: structuredClone(
              condition.waitingProcessIds,
            ),
          }),
        ),
      })),
      processes: this.state.program.processes.map(
        (process) => ({
          id: process.id,
          state: process.state,
          programCounter: process.programCounter,
          localMemory: structuredClone(
            process.localMemory,
          ),
          callStack: process.callStack.map(
            (frame) => ({
              functionName: frame.functionName,
              localMemory: structuredClone(
                frame.localMemory,
              ),
            }),
          ),
          monitorCallStack: (
            process.monitorCallStack ?? []
          ).map((frame) => ({
            monitorName: frame.monitorName,
            procedureName: frame.procedureName,
            localMemory: structuredClone(frame.localMemory),
          })),
          blockingReason: process.blockingReason
            ? structuredClone(process.blockingReason)
            : undefined,
        }),
      ),
      microOperationHistory: structuredClone(
        microOperationHistory,
      ),
      memoryAccessConflicts,
      memoryConflictSummaries:
        summarizeMemoryAccessConflicts(
          memoryAccessConflicts,
      ),
    }
  }

  private getCurrentInstruction(
    process: Process,
  ): Instruction | undefined {
    const frame =
      process.executionStack[
        process.executionStack.length - 1
      ]

    if (frame) {
      return frame.instructions[
        frame.programCounter
      ]
    }

    return process.instructions[
      process.programCounter
    ]
  }

  private findSharedVariableReferences(
    process: Process,
    expression: Expression,
  ): string[] {
    const references = new Set<string>()
    const localMemory =
      this.getActiveLocalMemory(process)
    const sharedMemory =
      this.state.program.sharedMemory

    const visit = (candidate: Expression): void => {
      switch (candidate.type) {
        case 'LITERAL':
          return

        case 'VARIABLE':
          if (
            !(candidate.name in localMemory)
            && candidate.name in sharedMemory
          ) {
            references.add(candidate.name)
          }
          return

        case 'UNARY':
          visit(candidate.operand)
          return

        case 'BINARY':
          visit(candidate.left)
          visit(candidate.right)
          return

        case 'ARRAY_ACCESS':
          visit(candidate.array)
          visit(candidate.index)
          return

        case 'FIELD_ACCESS':
          visit(candidate.record)
          return

        case 'RECORD_GETTER':
          visit(candidate.record)
          return

        case 'FUNCTION_CALL':
          candidate.arguments.forEach(visit)
          return
      }
    }

    visit(expression)

    return [...references].sort()
  }

  private advanceProcess(
    process: Process,
  ): void {
    const frame =
      process.executionStack[
        process.executionStack.length - 1
      ]

    if (!frame) {
      process.programCounter++
      return
    }

    frame.programCounter++

    if (
      frame.programCounter
      < frame.instructions.length
    ) {
      return
    }

    const completedFrame =
      process.executionStack.pop()

    if (!completedFrame) {
      return
    }

    this.completeFrame(
      process,
      completedFrame,
    )
  }

  private exitAtomicFrame(
    process: Process,
  ): void {
    process.atomicDepth -= 1

    if (process.atomicDepth < 0) {
      throw new Error(
        'Atomic depth cannot be negative',
      )
    }
  }

  private discardExecutionFramesFrom(
    process: Process,
    startIndex: number,
  ): ExecutionFrame[] {
    const removedFrames =
      process.executionStack.splice(startIndex)

    for (const frame of removedFrames) {
      if (
        frame.completionMode === 'EXIT_ATOMIC'
      ) {
        this.exitAtomicFrame(process)
      }
    }

    return removedFrames
  }

  private completeFrame(
    process: Process,
    frame: ExecutionFrame,
  ): void {
    switch (frame.completionMode) {
      case 'ADVANCE_PARENT':
        this.advanceProcess(process)
        return

      case 'REPEAT_PARENT':
        return

      case 'CHECK_REPEAT_UNTIL':
        this.completeRepeatUntil(
          process,
          frame,
        )
        return

      case 'FOR_CHECK':
        this.checkForCondition(
          process,
          frame,
        )
        return

      case 'FOR_INCREMENT':
        this.startForIncrement(
          process,
          frame,
        )
        return

      case 'FOREACH_NEXT':
        this.advanceForeach(
          process,
          frame,
        )
        return

      case 'FUNCTION_RETURN':
        this.completeFunctionCall(process)
        return

      case 'MONITOR_RETURN':
        this.completeMonitorProcedure(process)
        return

      case 'EXIT_ATOMIC': {
        this.exitAtomicFrame(process)
        this.advanceProcess(process)
        return
      }

    }
  }

  private checkForCondition(
    process: Process,
    frame: ExecutionFrame,
  ): void {
    const loop = frame.forLoop

    if (!loop) {
      throw new Error(
        'FOR frame is missing runtime information',
      )
    }

    if (
      this.containsFunctionCall(
        loop.condition,
      )
    ) {
      this.suspendExpression(
        process,
        loop.condition,
        {
          type: 'FOR_CONDITION',
          frame,
        },
      )

      return
    }

    const condition = evaluateExpression(
      loop.condition,
      {
        localMemory:
          this.getActiveLocalMemory(process),
        sharedMemory:
          this.state.program.sharedMemory,
      },
    )

    this.applyForCondition(
      process,
      frame,
      condition,
    )
  }

  private startForIncrement(
    process: Process,
    frame: ExecutionFrame,
  ): void {
    const loop = frame.forLoop

    if (!loop) {
      throw new Error(
        'FOR frame is missing runtime information',
      )
    }

    process.executionStack.push({
      instructions: [
        loop.increment,
      ],
      programCounter: 0,
      completionMode: 'FOR_CHECK',
      forLoop: loop,
    })
  }

  private completeRepeatUntil(
  process: Process,
  frame: ExecutionFrame,
): void {
  const condition =
    frame.repeatCondition

  if (!condition) {
    throw new Error(
      'Repeat frame is missing its condition',
    )
  }

  if (
    this.containsFunctionCall(condition)
  ) {
    this.suspendExpression(
      process,
      condition,
      {
        type: 'REPEAT_UNTIL_FRAME',
        frame,
      },
    )

    return
  }

  const result = evaluateExpression(
    condition,
    {
      localMemory:
        this.getActiveLocalMemory(process),
      sharedMemory:
        this.state.program.sharedMemory,
    },
  )

  this.applyRepeatUntilFrameCondition(
    process,
    result,
  )
}

  private advanceForeach(
    process: Process,
    frame: ExecutionFrame,
  ): void {
    const loop = frame.foreachLoop

    if (!loop) {
      throw new Error(
        'FOREACH frame is missing runtime information',
      )
    }

    loop.index++

    if (loop.index >= loop.values.length) {
      this.advanceProcess(process)
      return
    }

    this.getActiveLocalMemory(process)[
      loop.itemName
    ] = structuredClone(loop.values[loop.index])

    process.executionStack.push({
      instructions: loop.body,
      programCounter: 0,
      completionMode: 'FOREACH_NEXT',
      foreachLoop: loop,
    })
  }

  private breakLoop(
    process: Process,
  ): void {
    const loopIndex =
      this.findNearestLoopFrameIndex(process)

    if (loopIndex === -1) {
      throw new Error(
        'BREAK can only be used inside a loop',
      )
    }

    this.discardExecutionFramesFrom(
      process,
      loopIndex,
    )

    this.advanceProcess(process)
  }

  private continueLoop(
    process: Process,
  ): void {
    const loopIndex =
      this.findNearestLoopFrameIndex(process)

    if (loopIndex === -1) {
      throw new Error(
        'CONTINUE can only be used inside a loop',
      )
    }

    const loopFrame =
      process.executionStack[loopIndex]

    this.discardExecutionFramesFrom(
      process,
      loopIndex,
    )

    switch (loopFrame.completionMode) {
      case 'REPEAT_PARENT':
        return

      case 'CHECK_REPEAT_UNTIL':
        this.completeRepeatUntil(
          process,
          loopFrame,
        )
        return

      case 'FOR_INCREMENT':
        this.startForIncrement(
          process,
          loopFrame,
        )
        return

      case 'FOREACH_NEXT':
        this.advanceForeach(
          process,
          loopFrame,
        )
        return

      default:
        throw new Error(
          'Invalid loop frame for CONTINUE',
        )
    }
  }

  private findNearestLoopFrameIndex(
    process: Process,
  ): number {
    for (
      let index =
        process.executionStack.length - 1;
      index >= 0;
      index--
    ) {
      const mode =
        process.executionStack[index]
          .completionMode

      if (
        mode === 'FUNCTION_RETURN'
        || mode === 'MONITOR_RETURN'
      ) {
        return -1
      }

      if (
        mode === 'REPEAT_PARENT'
        || mode === 'CHECK_REPEAT_UNTIL'
        || mode === 'FOR_INCREMENT'
        || mode === 'FOREACH_NEXT'
      ) {
        return index
      }
    }

    return -1
  }

  private completeFunctionCall(
    process: Process,
  ): void {
    const frame = process.callStack.pop()

    if (!frame) {
      throw new Error(
        'Function call stack is empty',
      )
    }

    process.lastReturnValue =
      frame.returnValue

    if (frame.resumesExpression) {
      this.completePendingExpression(
        process,
        frame.returnValue,
      )

      return
    }

    this.advanceProcess(process)
  }

  private getActiveLocalMemory(
    process: Process,
  ) {
    for (
      let index = process.executionStack.length - 1;
      index >= 0;
      index--
    ) {
      const mode = process.executionStack[index].completionMode

      if (mode === 'FUNCTION_RETURN') {
        return process.callStack.at(-1)?.localMemory
          ?? process.localMemory
      }

      if (mode === 'MONITOR_RETURN') {
        return process.monitorCallStack?.at(-1)?.localMemory
          ?? process.localMemory
      }
    }

    return process.localMemory
  }

  private executeReturn(
    process: Process,
    expression?: Expression,
  ): void {
    for (
      let index = process.executionStack.length - 1;
      index >= 0;
      index--
    ) {
      const mode = process.executionStack[index].completionMode

      if (mode === 'MONITOR_RETURN') {
        throw new Error(
          'RETURN cannot leave a monitor procedure',
        )
      }

      if (mode === 'FUNCTION_RETURN') {
        break
      }
    }

    const callFrame =
      process.callStack[
        process.callStack.length - 1
      ]

    if (!callFrame) {
      throw new Error(
        'RETURN can only be used inside a function',
      )
    }

    if (expression) {
      callFrame.returnValue =
        evaluateExpression(
          expression,
          {
            localMemory:
              this.getActiveLocalMemory(process),
            sharedMemory:
              this.state.program.sharedMemory,
          },
        )
    }

    this.unwindCurrentFunction(process)
  }

  private unwindCurrentFunction(
    process: Process,
  ): void {
    let foundFunctionBoundary = false

    while (
      process.executionStack.length > 0
    ) {
      const frame =
        process.executionStack.pop()

      if (!frame) {
        break
      }

      if (
        frame.completionMode === 'EXIT_ATOMIC'
      ) {
        this.exitAtomicFrame(process)
      }

      if (
        frame.completionMode === 'FUNCTION_RETURN'
      ) {
        foundFunctionBoundary = true
        break
      }
    }

    if (!foundFunctionBoundary) {
      throw new Error(
        'Function execution frame not found',
      )
    }

    this.completeFunctionCall(process)
  }

  private containsFunctionCall(
    expression: Expression,
  ): boolean {
    switch (expression.type) {
      case 'FUNCTION_CALL':
        return true

      case 'BINARY':
        return (
          this.containsFunctionCall(expression.left)
          || this.containsFunctionCall(expression.right)
        )

      case 'UNARY':
        return this.containsFunctionCall(
          expression.operand,
        )

      case 'ARRAY_ACCESS':
        return (
          this.containsFunctionCall(expression.array)
          || this.containsFunctionCall(expression.index)
        )

      case 'FIELD_ACCESS':
        return this.containsFunctionCall(
          expression.record,
        )

      case 'RECORD_GETTER':
        return this.containsFunctionCall(
          expression.record,
        )

      default:
        return false
    }
  }

  private startNextPendingFunction(
    process: Process,
  ): void {
    const evaluation =
      this.getCurrentPendingEvaluation(process)

    if (!evaluation) {
      throw new Error(
        'Missing pending evaluation',
      )
    }

    const pending =
      evaluation.pendingExpression

    if (!pending) {
      throw new Error(
        'Missing pending expression',
      )
    }

    const functionCall =
      this.findNextFunctionCall(
        pending.expression,
      )

    if (!functionCall) {
      throw new Error(
        'No function call found in pending expression',
      )
    }

    this.getFunctionDefinitionForCall(functionCall)

    evaluation.pendingExpression = {
      expression: pending.expression,
      activeCall: functionCall,
      functionArguments: {
        pendingArguments: structuredClone(
          functionCall.arguments,
        ),
        argumentIndex: 0,
        argumentValues: [],
      },
    }

    this.continuePendingFunctionArguments(process)
  }

  private hasPendingFunctionArgumentEvaluation(
    process: Process,
  ): boolean {
    return this.getCurrentPendingEvaluation(process)
      ?.pendingExpression.functionArguments !== undefined
  }

  private continuePendingFunctionArguments(
    process: Process,
  ): void {
    const evaluation =
      this.getCurrentPendingEvaluation(process)
    const pending = evaluation?.pendingExpression
    const functionCall = pending?.activeCall
    const argumentRuntime = pending?.functionArguments

    if (
      !evaluation
      || !pending
      || !functionCall
      || !argumentRuntime
    ) {
      throw new Error(
        'Missing pending function argument evaluation',
      )
    }

    while (
      argumentRuntime.argumentIndex
      < argumentRuntime.pendingArguments.length
    ) {
      const argumentIndex =
        argumentRuntime.argumentIndex
      const argument =
        argumentRuntime.pendingArguments[argumentIndex]
      const read = this.findNextSharedMemoryRead(
        process,
        argument,
      )

      if (read) {
        const value = this.readSharedMemoryLocation(
          read.location,
        )
        const locationDescription =
          this.formatMemoryLocation(read.location)

        this.recordMicroOperation(
          process,
          'SHARED_READ',
          `${locationDescription} = ${JSON.stringify(value)}`,
          read.location,
        )

        argumentRuntime.pendingArguments[argumentIndex] =
          this.replaceExpressionWithValue(
            argument,
            read.expression,
            value,
          )

        return
      }

      const value = evaluateExpression(
        argument,
        {
          localMemory:
            this.getActiveLocalMemory(process),
          sharedMemory:
            this.state.program.sharedMemory,
        },
      )

      argumentRuntime.argumentValues.push(
        structuredClone(value),
      )
      argumentRuntime.argumentIndex++
    }

    evaluation.pendingExpression = {
      expression: pending.expression,
      activeCall: functionCall,
    }

    this.startFunctionCallExpression(
      process,
      functionCall,
      argumentRuntime.argumentValues,
    )
  }

  private startFunctionCallExpression(
    process: Process,
    expression: FunctionCallExpression,
    argumentValues: RuntimeValue[],
  ): void {
    const functionDefinition =
      this.getFunctionDefinitionForCall(expression)

    const functionMemory: Record<
      string,
      RuntimeValue
    > = {}

    functionDefinition.parameters.forEach(
      (parameter, index) => {
        functionMemory[parameter] =
          structuredClone(
            argumentValues[index],
          )
      },
    )

    process.callStack.push({
      functionName:
        functionDefinition.name,
      localMemory: functionMemory,
      resumesExpression: true,
    })

    if (
      functionDefinition.body.length === 0
    ) {
      throw new Error(
        `Function "${functionDefinition.name}" used as expression did not return a value`,
      )
    }

    process.executionStack.push({
      instructions:
        functionDefinition.body,
      programCounter: 0,
      completionMode:
        'FUNCTION_RETURN',
    })
  }

  private getFunctionDefinitionForCall(
    expression: FunctionCallExpression,
  ): FunctionDefinition {
    const functionDefinition =
      this.state.program.functions?.[
        expression.functionName
      ]

    if (!functionDefinition) {
      throw new Error(
        `Function "${expression.functionName}" is not defined`,
      )
    }

    if (
      expression.arguments.length
      !== functionDefinition.parameters.length
    ) {
      throw new Error(
        `Function "${expression.functionName}" expected `
        + `${functionDefinition.parameters.length} arguments `
        + `but received ${expression.arguments.length}`,
      )
    }

    return functionDefinition
  }

  private completePendingExpression(
    process: Process,
    value: RuntimeValue | undefined,
  ): void {
    if (value === undefined) {
      throw new Error(
        'Function used as expression did not return a value',
      )
    }

    const evaluation =
      this.getCurrentPendingEvaluation(process)

    if (!evaluation) {
      throw new Error(
        'Missing pending evaluation',
      )
    }

    const pendingExpression =
      evaluation.pendingExpression

    if (!pendingExpression) {
      throw new Error(
        'Missing pending expression',
      )
    }

    const activeCall =
      pendingExpression.activeCall

    if (!activeCall) {
      throw new Error(
        'Missing active function call',
      )
    }

    const newExpression =
      this.replaceFunctionCallWithValue(
        pendingExpression.expression,
        activeCall,
        value,
      )

    evaluation.pendingExpression = {
      expression: newExpression,
    }

    if (
      this.containsFunctionCall(
        newExpression,
      )
    ) {
      this.startNextPendingFunction(
        process,
      )

      return
    }

    if (
      this.startResolvedAssignmentMicroOperations(
        process,
        newExpression,
      )
    ) {
      return
    }

    const finalValue =
      evaluateExpression(
        newExpression,
        {
          localMemory:
            this.getActiveLocalMemory(process),

          sharedMemory:
            this.state.program.sharedMemory,
        },
      )

    this.completePendingInstruction(
      process,
      finalValue,
    )
  }

  private completePendingInstruction(
    process: Process,
    value: RuntimeValue,
  ): void {
    const pending =
      this.takePendingInstruction(process)

    switch (pending.type) {
      case 'DECLARE':
        this.assertDeclarationValue(
          pending.name,
          pending.declaredType,
          value,
        )

        if (pending.scope === 'LOCAL') {
          this.getActiveLocalMemory(process)[
            pending.name
          ] = structuredClone(value)
        } else {
          this.state.program.sharedMemory[
            pending.name
          ] = structuredClone(value)
        }

        this.advanceProcess(process)
        return

      case 'ASSIGN':
        this.completeAssignmentValue(
          process,
          pending.target,
          value,
        )
        return

      case 'IF':
        this.applyIfCondition(
          process,
          pending.instruction,
          value,
        )
        return

      case 'WHILE':
        this.applyWhileCondition(
          process,
          pending.instruction,
          value,
        )
        return

      case 'REPEAT_UNTIL':
        this.applyRepeatUntilCondition(
          process,
          value,
        )
        return

      case 'REPEAT_UNTIL_FRAME':
        this.applyRepeatUntilFrameCondition(
          process,
          value,
        )
        return

      case 'FOR_CONDITION':
        this.applyForCondition(
          process,
          pending.frame,
          value,
        )
        return

      case 'RETURN':
        this.executeReturnValue(
          process,
          value,
        )
        return

      case 'CALL_ARGUMENTS':
        this.completePendingCallArguments(
          process,
          pending.instruction,
          pending.argumentIndex,
          value,
        )
        return

      case 'FOREACH_COLLECTION':
        this.applyForeachCollection(
          process,
          pending.instruction,
          value,
        )
        return

      case 'ASSIGN_TARGET_INDEX':
        if (pending.target.type === 'ARRAY_RECORD_FIELD') {
          this.applyArrayRecordFieldAssignment(
            process,
            pending.target.arrayName,
            value,
            pending.target.fieldName,
            pending.value,
          )
        } else {
          this.applyArrayAssignment(
            process,
            pending.target.arrayName,
            value,
            pending.value,
          )
        }

        this.advanceProcess(process)
        return
    }
  }

  private takePendingInstruction(
    process: Process,
  ): PendingInstruction {
    const evaluation =
      process.pendingEvaluations.pop()

    if (!evaluation) {
      throw new Error(
        'Missing pending evaluation',
      )
    }

    process.expressionRuntimeStatus =
      process.pendingEvaluations.length > 0
        ? 'WAITING_FOR_FUNCTION'
        : 'IDLE'

    return evaluation.pendingInstruction
  }

  private startResolvedAssignmentMicroOperations(
    process: Process,
    expression: Expression,
  ): boolean {
    const evaluation =
      this.getCurrentPendingEvaluation(process)
    const pending = evaluation?.pendingInstruction

    if (!pending || pending.type !== 'ASSIGN') {
      return false
    }

    const targetIndexContainsFunction =
      (pending.target.type === 'ARRAY_ACCESS'
      || pending.target.type === 'ARRAY_RECORD_FIELD')
      && this.containsFunctionCall(pending.target.index)

    if (targetIndexContainsFunction) {
      return false
    }

    if (
      !this.isSharedAssignmentTarget(
        process,
        pending.target,
      )
      && !this.findNextSharedMemoryRead(
        process,
        expression,
      )
    ) {
      return false
    }

    this.takePendingInstruction(process)

    process.microOperationRuntime = {
      type: 'SHARED_ASSIGNMENT',
      instruction: {
        type: 'ASSIGN',
        target: structuredClone(pending.target),
        expression: structuredClone(expression),
      },
      phase: 'READ',
      pendingExpression: structuredClone(expression),
      pendingTargetIndex:
        pending.target.type === 'ARRAY_ACCESS'
        || pending.target.type === 'ARRAY_RECORD_FIELD'
          ? structuredClone(pending.target.index)
          : undefined,
    }

    return true
  }

  private findNextFunctionCall(
    expression: Expression,
  ): FunctionCallExpression | undefined {
    switch (expression.type) {
      case 'FUNCTION_CALL': {
        for (
          const argument
          of expression.arguments
        ) {
          const nestedCall =
            this.findNextFunctionCall(
              argument,
            )

          if (nestedCall) {
            return nestedCall
          }
        }

        return expression
      }

      case 'BINARY':
        return (
          this.findNextFunctionCall(
            expression.left,
          )
          ?? this.findNextFunctionCall(
            expression.right,
          )
        )

      case 'UNARY':
        return this.findNextFunctionCall(
          expression.operand,
        )

      case 'ARRAY_ACCESS':
        return (
          this.findNextFunctionCall(
            expression.array,
          )
          ?? this.findNextFunctionCall(
            expression.index,
          )
        )

      case 'FIELD_ACCESS':
        return this.findNextFunctionCall(
          expression.record,
        )

      case 'RECORD_GETTER':
        return this.findNextFunctionCall(
          expression.record,
        )

      default:
        return undefined
    }
  }

  private replaceFunctionCallWithValue(
    expression: Expression,
    target: FunctionCallExpression,
    value: RuntimeValue,
  ): Expression {
    if (expression === target) {
      return {
        type: 'LITERAL',
        value,
      }
    }

    switch (expression.type) {
      case 'BINARY':
        return {
          ...expression,

          left:
            this.replaceFunctionCallWithValue(
              expression.left,
              target,
              value,
            ),

          right:
            this.replaceFunctionCallWithValue(
              expression.right,
              target,
              value,
            ),
        }

      case 'UNARY':
        return {
          ...expression,

          operand:
            this.replaceFunctionCallWithValue(
              expression.operand,
              target,
              value,
            ),
        }

      case 'ARRAY_ACCESS':
        return {
          ...expression,

          array:
            this.replaceFunctionCallWithValue(
              expression.array,
              target,
              value,
            ),

          index:
            this.replaceFunctionCallWithValue(
              expression.index,
              target,
              value,
            ),
        }

      case 'FIELD_ACCESS':
        return {
          ...expression,
          record:
            this.replaceFunctionCallWithValue(
              expression.record,
              target,
              value,
            ),
        }

      case 'RECORD_GETTER':
        return {
          ...expression,
          record:
            this.replaceFunctionCallWithValue(
              expression.record,
              target,
              value,
            ),
        }

      case 'FUNCTION_CALL':
        return {
          ...expression,

          arguments:
            expression.arguments.map(
              (argument) =>
                this.replaceFunctionCallWithValue(
                  argument,
                  target,
                  value,
                ),
            ),
        }

      default:
        return expression
    }
  }

  private suspendExpression(
    process: Process,
    expression: Expression,
    pendingInstruction: PendingInstruction,
  ): void {
    process.pendingEvaluations.push({
      pendingExpression: {
        expression,
      },
      pendingInstruction,
    })

    process.expressionRuntimeStatus =
      'WAITING_FOR_FUNCTION'

    this.startNextPendingFunction(process)
  }

  private evaluateArrayIndex(
    process: Process,
    expression: Expression,
  ): number | undefined {
    if (
      this.containsFunctionCall(expression)
      || this.findNextSharedMemoryRead(
        process,
        expression,
      )
    ) {
      return undefined
    }

    const value = evaluateExpression(
      expression,
      {
        localMemory:
          this.getActiveLocalMemory(process),
        sharedMemory:
          this.state.program.sharedMemory,
      },
    )

    if (
      typeof value !== 'number'
      || !Number.isInteger(value)
    ) {
      throw new Error(
        'Array index must evaluate to an integer',
      )
    }

    return value
  }

  private readSharedMemoryLocation(
    location: MemoryLocation,
  ): RuntimeValue {
    if (location.type === 'VARIABLE') {
      const value =
        this.state.program.sharedMemory[
          location.name
        ]

      if (value === undefined) {
        throw new Error(
          `Shared variable "${location.name}" is not defined`,
        )
      }

      return structuredClone(value)
    }

    if (location.type === 'RECORD_FIELD') {
      const record = this.state.program.sharedMemory[
        location.recordName
      ]

      if (!isRecordValue(record)) {
        throw new Error(
          `Shared variable "${location.recordName}" is not a record`,
        )
      }

      if (!(location.fieldName in record.fields)) {
        throw new Error(
          `Record "${record.recordType}" has no field "${location.fieldName}"`,
        )
      }

      return structuredClone(
        record.fields[location.fieldName],
      )
    }

    if (location.type === 'ARRAY_RECORD_FIELD') {
      const array = this.state.program.sharedMemory[
        location.arrayName
      ]

      if (!Array.isArray(array)) {
        throw new Error(
          `Shared variable "${location.arrayName}" is not an array`,
        )
      }

      if (
        location.index < 0
        || location.index >= array.length
      ) {
        throw new Error(
          `Array index ${location.index} is out of bounds`,
        )
      }

      const record = array[location.index]

      if (!isRecordValue(record)) {
        throw new Error(
          `Array element "${location.arrayName}[${location.index}]" is not a record`,
        )
      }

      if (!(location.fieldName in record.fields)) {
        throw new Error(
          `Record "${record.recordType}" has no field "${location.fieldName}"`,
        )
      }

      return structuredClone(
        record.fields[location.fieldName],
      )
    }

    const array =
      this.state.program.sharedMemory[
        location.arrayName
      ]

    if (!Array.isArray(array)) {
      throw new Error(
        `Shared variable "${location.arrayName}" is not an array`,
      )
    }

    if (
      location.index < 0
      || location.index >= array.length
    ) {
      throw new Error(
        `Array index ${location.index} is out of bounds`,
      )
    }

    const value = array[location.index]

    if (value === undefined) {
      throw new Error(
        `Shared array element "${location.arrayName}[${location.index}]" is not defined`,
      )
    }

    return structuredClone(value)
  }

  private formatMemoryLocation(
      location: MemoryLocation,
  ): string {
    if (location.type === 'VARIABLE') {
      return location.name
    }

    if (location.type === 'RECORD_FIELD') {
      return `${location.recordName}.${location.fieldName}`
    }

    if (location.type === 'ARRAY_RECORD_FIELD') {
      return `${location.arrayName}[${location.index}].${location.fieldName}`
    }

    return `${location.arrayName}[${location.index}]`
  }

  private findNextSharedMemoryRead(
    process: Process,
    expression: Expression,
  ): SharedMemoryRead | undefined {
    switch (expression.type) {
      case 'VARIABLE': {
        const localMemory =
          this.getActiveLocalMemory(process)

        if (
          expression.name in localMemory
          || !(expression.name
            in this.state.program.sharedMemory)
        ) {
          return undefined
        }

        return {
          expression,
          location: {
            type: 'VARIABLE',
            name: expression.name,
          },
        }
      }

      case 'BINARY':
        return (
          this.findNextSharedMemoryRead(
            process,
            expression.left,
          )
          ?? this.findNextSharedMemoryRead(
            process,
            expression.right,
          )
        )

      case 'UNARY':
        return this.findNextSharedMemoryRead(
          process,
          expression.operand,
        )

      case 'ARRAY_ACCESS': {
        if (
          expression.array.type === 'VARIABLE'
        ) {
          const arrayName =
            expression.array.name

          const localMemory =
            this.getActiveLocalMemory(process)

          const isSharedArray =
            !(arrayName in localMemory)
            && arrayName
              in this.state.program.sharedMemory

          if (isSharedArray) {
            const indexRead =
              this.findNextSharedMemoryRead(
                process,
                expression.index,
              )

            if (indexRead) {
              return indexRead
            }

            const index =
              this.evaluateArrayIndex(
                process,
                expression.index,
              )

            if (index !== undefined) {
              return {
                expression,
                location: {
                  type: 'ARRAY_ELEMENT',
                  arrayName,
                  index,
                },
              }
            }
          }
        }

        return (
          this.findNextSharedMemoryRead(
            process,
            expression.array,
          )
          ?? this.findNextSharedMemoryRead(
            process,
            expression.index,
          )
        )
      }

      case 'FIELD_ACCESS': {
        if (
          expression.record.type === 'ARRAY_ACCESS'
          && expression.record.array.type === 'VARIABLE'
        ) {
          const arrayName = expression.record.array.name
          const localMemory =
            this.getActiveLocalMemory(process)

          if (
            !(arrayName in localMemory)
            && arrayName in this.state.program.sharedMemory
          ) {
            const indexRead = this.findNextSharedMemoryRead(
              process,
              expression.record.index,
            )

            if (indexRead) {
              return indexRead
            }

            const index = this.evaluateArrayIndex(
              process,
              expression.record.index,
            )

            if (index !== undefined) {
              return {
                expression,
                location: {
                  type: 'ARRAY_RECORD_FIELD',
                  arrayName,
                  index,
                  fieldName: expression.fieldName,
                },
              }
            }
          }
        }

        if (expression.record.type === 'VARIABLE') {
          const recordName = expression.record.name
          const localMemory =
            this.getActiveLocalMemory(process)

          if (
            !(recordName in localMemory)
            && recordName in this.state.program.sharedMemory
          ) {
            return {
              expression,
              location: {
                type: 'RECORD_FIELD',
                recordName,
                fieldName: expression.fieldName,
              },
            }
          }
        }

        return this.findNextSharedMemoryRead(
          process,
          expression.record,
        )
      }

      case 'RECORD_GETTER': {
        if (
          expression.record.type === 'ARRAY_ACCESS'
          && expression.record.array.type === 'VARIABLE'
        ) {
          const arrayName = expression.record.array.name
          const localMemory =
            this.getActiveLocalMemory(process)
          const sharedArray =
            this.state.program.sharedMemory[arrayName]

          if (
            !(arrayName in localMemory)
            && Array.isArray(sharedArray)
          ) {
            const indexRead = this.findNextSharedMemoryRead(
              process,
              expression.record.index,
            )

            if (indexRead) {
              return indexRead
            }

            const index = this.evaluateArrayIndex(
              process,
              expression.record.index,
            )

            if (index !== undefined) {
              const record = sharedArray[index]

              if (!isRecordValue(record)) {
                throw new Error(
                  `Array element "${arrayName}[${index}]" is not a record`,
                )
              }

              return {
                expression,
                location: {
                  type: 'ARRAY_RECORD_FIELD',
                  arrayName,
                  index,
                  fieldName: resolveRecordGetterFieldName(
                    record,
                    expression.getterName,
                  ),
                },
              }
            }
          }
        }

        if (expression.record.type === 'VARIABLE') {
          const recordName = expression.record.name
          const localMemory =
            this.getActiveLocalMemory(process)
          const sharedValue =
            this.state.program.sharedMemory[recordName]

          if (
            !(recordName in localMemory)
            && isRecordValue(sharedValue)
          ) {
            return {
              expression,
              location: {
                type: 'RECORD_FIELD',
                recordName,
                fieldName:
                  resolveRecordGetterFieldName(
                    sharedValue,
                    expression.getterName,
                  ),
              },
            }
          }
        }

        return this.findNextSharedMemoryRead(
          process,
          expression.record,
        )
      }

      case 'FUNCTION_CALL':
        for (const argument of expression.arguments) {
          const read =
            this.findNextSharedMemoryRead(
              process,
              argument,
            )

          if (read) {
            return read
          }
        }

        return undefined

      default:
        return undefined
    }
  }

  private replaceExpressionWithValue(
    expression: Expression,
    target: Expression,
    value: RuntimeValue,
  ): Expression {
    if (expression === target) {
      return {
        type: 'LITERAL',
        value: structuredClone(value),
      }
    }

    switch (expression.type) {
      case 'BINARY':
        return {
          ...expression,
          left: this.replaceExpressionWithValue(
            expression.left,
            target,
            value,
          ),
          right: this.replaceExpressionWithValue(
            expression.right,
            target,
            value,
          ),
        }

      case 'UNARY':
        return {
          ...expression,
          operand:
            this.replaceExpressionWithValue(
              expression.operand,
              target,
              value,
            ),
        }

      case 'ARRAY_ACCESS':
        return {
          ...expression,
          array:
            this.replaceExpressionWithValue(
              expression.array,
              target,
              value,
            ),
          index:
            this.replaceExpressionWithValue(
              expression.index,
              target,
              value,
            ),
        }

      case 'FIELD_ACCESS':
        return {
          ...expression,
          record:
            this.replaceExpressionWithValue(
              expression.record,
              target,
              value,
            ),
        }

      case 'RECORD_GETTER':
        return {
          ...expression,
          record:
            this.replaceExpressionWithValue(
              expression.record,
              target,
              value,
            ),
        }

      case 'FUNCTION_CALL':
        return {
          ...expression,
          arguments: expression.arguments.map(
            (argument) =>
              this.replaceExpressionWithValue(
                argument,
                target,
                value,
              ),
          ),
        }

      default:
        return expression
    }
  }

  private executeAssignmentMicroOperation(
    process: Process,
    instruction: Extract<
      Instruction,
      { type: 'ASSIGN' }
    >,
  ): void {
    
    let runtime = process.microOperationRuntime

    if (!runtime) {
      runtime = {
        type: 'SHARED_ASSIGNMENT',
        instruction,
        phase: 'READ',
        pendingExpression:
          structuredClone(instruction.expression),

        pendingTargetIndex:
          instruction.target.type === 'ARRAY_ACCESS'
          || instruction.target.type === 'ARRAY_RECORD_FIELD'
            ? structuredClone(
                instruction.target.index,
              )
            : undefined,
      }

      process.microOperationRuntime = runtime
    }

    if (runtime.type !== 'SHARED_ASSIGNMENT') {
      throw new Error(
        'Invalid micro-operation runtime',
      )
    }

    switch (runtime.phase) {
      case 'READ': {
        const read =
          this.findNextSharedMemoryRead(
            process,
            runtime.pendingExpression,
          )

        if (!read) {
          const value = evaluateExpression(
            runtime.pendingExpression,
            {
              localMemory:
                this.getActiveLocalMemory(process),
              sharedMemory:
                this.state.program.sharedMemory,
            },
          )

          runtime.computedValue = value

          this.recordMicroOperation(
            process,
            'COMPUTE',
            `result = ${JSON.stringify(value)}`,
          )

          if (
            runtime.instruction.target.type
            === 'ARRAY_ACCESS'
            || runtime.instruction.target.type
            === 'ARRAY_RECORD_FIELD'
          ) {
            runtime.phase = 'TARGET_READ'
          } else {
            runtime.targetLocation =
              this.resolveMicroOperationTargetLocation(
                process,
                runtime,
              )

            runtime.phase = 'WRITE'
          }

          return
        }

        const value =
          this.readSharedMemoryLocation(
            read.location,
          )

        const locationDescription =
          this.formatMemoryLocation(
            read.location,
          )

        this.recordMicroOperation(
          process,
          'SHARED_READ',
          `${locationDescription} = ${JSON.stringify(value)}`,
          read.location,
        )

        runtime.pendingExpression =
          this.replaceExpressionWithValue(
            runtime.pendingExpression,
            read.expression,
            value,
          )

        if (
          !this.findNextSharedMemoryRead(
            process,
            runtime.pendingExpression,
          )
        ) {
          runtime.phase = 'COMPUTE'
        }

        return
      }

      case 'COMPUTE': {
        runtime.computedValue =
          evaluateExpression(
            runtime.pendingExpression,
            {
              localMemory:
                this.getActiveLocalMemory(process),
              sharedMemory:
                this.state.program.sharedMemory,
            },
          )

        this.recordMicroOperation(
          process,
          'COMPUTE',
          `result = ${JSON.stringify(
            runtime.computedValue,
          )}`,
        )

        if (
          runtime.instruction.target.type
          === 'ARRAY_ACCESS'
          || runtime.instruction.target.type
          === 'ARRAY_RECORD_FIELD'
        ) {
          runtime.phase = 'TARGET_READ'
        } else {
          runtime.targetLocation =
            this.resolveMicroOperationTargetLocation(
              process,
              runtime,
            )

          runtime.phase = 'WRITE'
        }

        return
      }

      case 'TARGET_READ': {
        if (
          runtime.instruction.target.type
          !== 'ARRAY_ACCESS'
          && runtime.instruction.target.type
          !== 'ARRAY_RECORD_FIELD'
        ) {
          throw new Error(
            'TARGET_READ requires an array assignment target',
          )
        }

        if (!runtime.pendingTargetIndex) {
          throw new Error(
            'Array assignment target has no pending index',
          )
        }

        const read =
          this.findNextSharedMemoryRead(
            process,
            runtime.pendingTargetIndex,
          )

        if (read) {
          const value =
            this.readSharedMemoryLocation(
              read.location,
            )

          const locationDescription =
            this.formatMemoryLocation(
              read.location,
            )

          this.recordMicroOperation(
            process,
            'SHARED_READ',
            `${locationDescription} = ${JSON.stringify(
              value,
            )}`,
            read.location,
          )

          runtime.pendingTargetIndex =
            this.replaceExpressionWithValue(
              runtime.pendingTargetIndex,
              read.expression,
              value,
            )

          return
        }

        runtime.targetLocation =
          this.resolveMicroOperationTargetLocation(
            process,
            runtime,
          )

        runtime.phase = 'WRITE'

        this.executeAssignmentMicroOperation(
          process,
          instruction,
        )

        return
      }

      case 'WRITE': {
        if (runtime.computedValue === undefined) {
          throw new Error(
            'Shared assignment has no computed value',
          )
        }

        const location =
          runtime.targetLocation
          ?? this.resolveMicroOperationTargetLocation(
            process,
            runtime,
          )

        if (!location) {
          if (
            !this.isSharedAssignmentTarget(
              process,
              runtime.instruction.target,
            )
          ) {
            const localTarget =
              (runtime.instruction.target.type === 'ARRAY_ACCESS'
              || runtime.instruction.target.type === 'ARRAY_RECORD_FIELD')
              && runtime.pendingTargetIndex
                ? {
                    ...runtime.instruction.target,
                    index: runtime.pendingTargetIndex,
                  }
                : runtime.instruction.target

            this.applyAssignment(
              process,
              localTarget,
              runtime.computedValue,
            )
            process.microOperationRuntime = undefined
            this.advanceProcess(process)
            return
          }

          throw new Error(
            'Shared assignment target could not be resolved',
          )
        }

        this.writeSharedMemoryLocation(
          location,
          runtime.computedValue,
        )

        const locationDescription =
          this.formatMemoryLocation(location)

        this.recordMicroOperation(
          process,
          'SHARED_WRITE',
          `${locationDescription} = ${JSON.stringify(
            runtime.computedValue,
          )}`,
          location,
        )

        process.microOperationRuntime = undefined

        this.advanceProcess(process)
        return
      }
    }
  }

  private isSharedAssignmentTarget(
    process: Process,
    target: AssignmentTarget,
  ): boolean {
    const localMemory =
      this.getActiveLocalMemory(process)

    const variableName = target.type === 'VARIABLE'
      ? target.name
      : target.type === 'ARRAY_ACCESS'
        || target.type === 'ARRAY_RECORD_FIELD'
        ? target.arrayName
        : target.recordName

    if (variableName in localMemory) {
      return false
    }

    return variableName
      in this.state.program.sharedMemory
  }

  private applyAssignment(
    process: Process,
    target: AssignmentTarget,
    value: RuntimeValue,
  ): void {
    if (target.type === 'VARIABLE') {
      writeVariable(
        target.name,
        value,
        this.getActiveLocalMemory(process),
        this.state.program.sharedMemory,
      )

      return
    }

    if (target.type === 'RECORD_FIELD') {
      const localMemory =
        this.getActiveLocalMemory(process)
      const record = target.recordName in localMemory
        ? localMemory[target.recordName]
        : this.state.program.sharedMemory[target.recordName]

      if (!isRecordValue(record)) {
        throw new Error(
          `Variable "${target.recordName}" is not a record`,
        )
      }

      if (!(target.fieldName in record.fields)) {
        throw new Error(
          `Record "${record.recordType}" has no field "${target.fieldName}"`,
        )
      }

      const previousValue = record.fields[target.fieldName]

      if (
        !isPrimitiveValue(value)
        || typeof value !== typeof previousValue
      ) {
        throw new Error(
          `Field "${target.recordName}.${target.fieldName}" requires ${typeof previousValue} but received ${typeof value}`,
        )
      }

      record.fields[target.fieldName] = structuredClone(value)
      return
    }

    const index = evaluateExpression(
      target.index,
      {
        localMemory:
          this.getActiveLocalMemory(process),
        sharedMemory:
          this.state.program.sharedMemory,
      },
    )

    if (target.type === 'ARRAY_RECORD_FIELD') {
      this.applyArrayRecordFieldAssignment(
        process,
        target.arrayName,
        index,
        target.fieldName,
        value,
      )
      return
    }

    this.applyArrayAssignment(
      process,
      target.arrayName,
      index,
      value,
    )
  }

  private applyIfCondition(
    process: Process,
    instruction: IfInstruction,
    condition: RuntimeValue,
  ): void {
    if (typeof condition !== 'boolean') {
      throw new Error(
        'IF condition must evaluate to boolean',
      )
    }

    const selectedBranch =
      condition
        ? instruction.thenBranch
        : instruction.elseBranch

    if (selectedBranch.length === 0) {
      this.advanceProcess(process)
      return
    }

    process.executionStack.push({
      instructions: selectedBranch,
      programCounter: 0,
      completionMode: 'ADVANCE_PARENT',
    })
  }

  private applyWhileCondition(
    process: Process,
    instruction: WhileInstruction,
    condition: RuntimeValue,
  ): void {
    if (typeof condition !== 'boolean') {
      throw new Error(
        'WHILE condition must evaluate to boolean',
      )
    }

    if (!condition) {
      this.advanceProcess(process)
      return
    }

    if (instruction.body.length === 0) {
      return
    }

    process.executionStack.push({
      instructions: instruction.body,
      programCounter: 0,
      completionMode: 'REPEAT_PARENT',
    })
  }

  private applyRepeatUntilCondition(
    process: Process,
    condition: RuntimeValue,
  ): void {
    if (typeof condition !== 'boolean') {
      throw new Error(
        'REPEAT UNTIL condition must evaluate to boolean',
      )
    }

    if (condition) {
      this.advanceProcess(process)
    }
  }

  private applyRepeatUntilFrameCondition(
    process: Process,
    condition: RuntimeValue,
  ): void {
    if (typeof condition !== 'boolean') {
      throw new Error(
        'REPEAT UNTIL condition must evaluate to boolean',
      )
    }

    if (condition) {
      this.advanceProcess(process)
    }
  }

  private executeReturnValue(
    process: Process,
    value: RuntimeValue,
  ): void {
    const callFrame =
      process.callStack[
        process.callStack.length - 1
      ]

    if (!callFrame) {
      throw new Error(
        'RETURN can only be used inside a function',
      )
    }

    callFrame.returnValue = value

    this.unwindCurrentFunction(process)
  }

  private executeCallInstruction(
    process: Process,
    instruction: CallInstruction,
  ): void {
    const functionDefinition =
      this.state.program.functions?.[
        instruction.functionName
      ]

    if (!functionDefinition) {
      throw new Error(
        `Function "${instruction.functionName}" is not defined`,
      )
    }

    if (
      instruction.arguments.length
      !== functionDefinition.parameters.length
    ) {
      throw new Error(
        `Function "${instruction.functionName}" expected `
        + `${functionDefinition.parameters.length} arguments `
        + `but received ${instruction.arguments.length}`,
      )
    }

    const callerMemory =
      this.getActiveLocalMemory(process)

    const argumentValues =
      instruction.arguments.map(
        (argument) =>
          evaluateExpression(
            argument,
            {
              localMemory: callerMemory,
              sharedMemory:
                this.state.program.sharedMemory,
            },
          ),
      )

    this.startFunctionWithValues(
      process,
      functionDefinition,
      argumentValues,
    )
  }

  private startFunctionWithValues(
    process: Process,
    functionDefinition: FunctionDefinition,
    argumentValues: RuntimeValue[],
  ): void {
    const functionMemory: Record<
      string,
      RuntimeValue
    > = {}

    functionDefinition.parameters.forEach(
      (parameter, index) => {
        functionMemory[parameter] =
          structuredClone(
            argumentValues[index],
          )
      },
    )

    process.callStack.push({
      functionName:
        functionDefinition.name,
        localMemory: functionMemory,
        resumesExpression: false,
    })

    if (
      functionDefinition.body.length === 0
    ) {
      process.callStack.pop()
      this.advanceProcess(process)
      return
    }

    process.executionStack.push({
      instructions:
        functionDefinition.body,
      programCounter: 0,
      completionMode:
        'FUNCTION_RETURN',
    })
  }

  private completePendingCallArguments(
    process: Process,
    instruction: CallInstruction,
    argumentIndex: number,
    value: RuntimeValue,
  ): void {
    const resolvedArgs =
      instruction.arguments.map(
        (argument, index) =>
          index === argumentIndex
            ? {
                type: 'LITERAL' as const,
                value,
              }
            : argument,
      )

    const nextFunctionArgumentIndex =
      resolvedArgs.findIndex(
        (argument) =>
          this.containsFunctionCall(
            argument,
          ),
      )

    if (
      nextFunctionArgumentIndex !== -1
    ) {
      this.suspendExpression(
        process,
        resolvedArgs[
          nextFunctionArgumentIndex
        ],
        {
          type: 'CALL_ARGUMENTS',
          instruction: {
            ...instruction,
            arguments: resolvedArgs,
          },
          argumentIndex:
            nextFunctionArgumentIndex,
        },
      )

      return
    }

    const finalInstruction: CallInstruction = {
      ...instruction,
      arguments: resolvedArgs,
    }

    this.executeCallInstruction(
      process,
      finalInstruction,
    )
  }

  private applyForCondition(
    process: Process,
    frame: ExecutionFrame,
    condition: RuntimeValue,
  ): void {
    const loop = frame.forLoop

    if (!loop) {
      throw new Error(
        'FOR frame is missing runtime information',
      )
    }

    if (typeof condition !== 'boolean') {
      throw new Error(
        'FOR condition must evaluate to boolean',
      )
    }

    if (!condition) {
      this.advanceProcess(process)
      return
    }

    if (loop.body.length === 0) {
      this.startForIncrement(
        process,
        frame,
      )

      return
    }

    process.executionStack.push({
      instructions: loop.body,
      programCounter: 0,
      completionMode: 'FOR_INCREMENT',
      forLoop: loop,
    })
  }

  private getCurrentPendingEvaluation(
    process: Process,
  ): PendingEvaluation | undefined {
    return process.pendingEvaluations[
      process.pendingEvaluations.length - 1
    ]
  }

  private applyForeachCollection(
    process: Process,
    instruction: ForeachInstruction,
    collection: RuntimeValue,
  ): void {
    if (!Array.isArray(collection)) {
      throw new Error(
        'FOREACH collection must be an array',
      )
    }

    if (collection.length === 0) {
      this.advanceProcess(process)
      return
    }

    this.getActiveLocalMemory(process)[
      instruction.itemName
    ] = structuredClone(collection[0])

    process.executionStack.push({
      instructions: instruction.body,
      programCounter: 0,
      completionMode: 'FOREACH_NEXT',
      foreachLoop: {
        itemName: instruction.itemName,
        values: structuredClone(collection),
        body: instruction.body,
        index: 0,
      },
    })
  }

  private applyArrayAssignment(
    process: Process,
    arrayName: string,
    index: RuntimeValue,
    value: RuntimeValue,
  ): void {
    if (
      typeof index !== 'number'
      || !Number.isInteger(index)
    ) {
      throw new Error(
        'Array index must be an integer',
      )
    }

    const localMemory =
      this.getActiveLocalMemory(process)

    const array =
      arrayName in localMemory
        ? localMemory[arrayName]
        : this.state.program.sharedMemory[
            arrayName
          ]

    if (!Array.isArray(array)) {
      throw new Error(
        `Variable "${arrayName}" is not an array`,
      )
    }

    if (
      index < 0
      || index >= array.length
    ) {
      throw new Error(
        `Array index ${index} is out of bounds`,
      )
    }

    assertArrayElementCompatible(
      array[index],
      value,
      `${arrayName}[${index}]`,
    )

    array[index] = structuredClone(value)
  }

  private applyArrayRecordFieldAssignment(
    process: Process,
    arrayName: string,
    index: RuntimeValue,
    fieldName: string,
    value: RuntimeValue,
  ): void {
    if (
      typeof index !== 'number'
      || !Number.isInteger(index)
    ) {
      throw new Error('Array index must be an integer')
    }

    const localMemory = this.getActiveLocalMemory(process)
    const array = arrayName in localMemory
      ? localMemory[arrayName]
      : this.state.program.sharedMemory[arrayName]

    if (!Array.isArray(array)) {
      throw new Error(`Variable "${arrayName}" is not an array`)
    }

    if (index < 0 || index >= array.length) {
      throw new Error(`Array index ${index} is out of bounds`)
    }

    const record = array[index]

    if (!isRecordValue(record)) {
      throw new Error(
        `Array element "${arrayName}[${index}]" is not a record`,
      )
    }

    if (!(fieldName in record.fields)) {
      throw new Error(
        `Record "${record.recordType}" has no field "${fieldName}"`,
      )
    }

    const previousValue = record.fields[fieldName]

    if (
      !isPrimitiveValue(value)
      || typeof value !== typeof previousValue
    ) {
      throw new Error(
        `Field "${arrayName}[${index}].${fieldName}" requires ${typeof previousValue} but received ${typeof value}`,
      )
    }

    record.fields[fieldName] = structuredClone(value)
  }

  private completeAssignmentValue(
    process: Process,
    target: AssignmentTarget,
    value: RuntimeValue,
  ): void {
    if (
      (target.type === 'ARRAY_ACCESS'
      || target.type === 'ARRAY_RECORD_FIELD')
      && this.containsFunctionCall(
        target.index,
      )
    ) {
      this.suspendExpression(
        process,
        target.index,
        {
          type: 'ASSIGN_TARGET_INDEX',
          target,
          value,
        },
      )

      return
    }

    this.applyAssignment(
      process,
      target,
      value,
    )

    this.advanceProcess(process)
  }

  private recordMicroOperation(
    process: Process,
    type:
      | 'INSTRUCTION'
      | 'SHARED_READ'
      | 'COMPUTE'
      | 'SHARED_WRITE',
    description: string,
    location?: MemoryLocation,
  ): void {
    this.state.microOperationHistory ??= []

    const event = {
      step: this.state.stepCount + 1,
      processId: process.id,
      type,
      description,
      location:
        location
          ? structuredClone(location)
          : undefined,
      atomicDepth: process.atomicDepth,
    }

    this.state.microOperationHistory.push(event)
    recordMicroOperationAnalysisEvent(
      this.getAnalysisState(),
      event,
    )
  }

  private getAnalysisState(): NonNullable<
    ExecutionState['analysisState']
  > {
    this.state.analysisState ??=
      reconstructExecutionAnalysisState(this.state)

    return this.state.analysisState
  }

  private resolveMicroOperationTargetLocation(
    process: Process,
    runtime: Extract<
      NonNullable<Process['microOperationRuntime']>,
      { type: 'SHARED_ASSIGNMENT' }
    >,
  ): MemoryLocation | undefined {
    const target = runtime.instruction.target

    if (target.type === 'VARIABLE') {
      return this.resolveAssignmentTargetLocation(
        process,
        target,
      )
    }

    if (target.type === 'RECORD_FIELD') {
      return this.resolveAssignmentTargetLocation(
        process,
        target,
      )
    }

    if (!runtime.pendingTargetIndex) {
      return undefined
    }

    const index =
      this.evaluateArrayIndex(
        process,
        runtime.pendingTargetIndex,
      )

    if (index === undefined) {
      return undefined
    }

    if (target.type === 'ARRAY_RECORD_FIELD') {
      return {
        type: 'ARRAY_RECORD_FIELD',
        arrayName: target.arrayName,
        index,
        fieldName: target.fieldName,
      }
    }

    return {
      type: 'ARRAY_ELEMENT',
      arrayName: target.arrayName,
      index,
    }
  }

  private resolveAssignmentTargetLocation(
    process: Process,
    target: AssignmentTarget,
  ): MemoryLocation | undefined {
    if (target.type === 'VARIABLE') {
      const localMemory =
        this.getActiveLocalMemory(process)

      if (target.name in localMemory) {
        return undefined
      }

      if (
        target.name
        in this.state.program.sharedMemory
      ) {
        return {
          type: 'VARIABLE',
          name: target.name,
        }
      }

      return undefined
    }

    if (target.type === 'RECORD_FIELD') {
      const localMemory =
        this.getActiveLocalMemory(process)

      if (target.recordName in localMemory) {
        return undefined
      }

      if (
        target.recordName
        in this.state.program.sharedMemory
      ) {
        return {
          type: 'RECORD_FIELD',
          recordName: target.recordName,
          fieldName: target.fieldName,
        }
      }

      return undefined
    }

    const localMemory =
      this.getActiveLocalMemory(process)

    if (target.arrayName in localMemory) {
      return undefined
    }

    if (
      !(target.arrayName
        in this.state.program.sharedMemory)
    ) {
      return undefined
    }

    const indexRead =
      this.findNextSharedMemoryRead(
        process,
        target.index,
      )

    if (indexRead) {
      return undefined
    }

    const index =
      this.evaluateArrayIndex(
        process,
        target.index,
      )

    if (index === undefined) {
      return undefined
    }

    if (target.type === 'ARRAY_RECORD_FIELD') {
      return {
        type: 'ARRAY_RECORD_FIELD',
        arrayName: target.arrayName,
        index,
        fieldName: target.fieldName,
      }
    }

    return {
      type: 'ARRAY_ELEMENT',
      arrayName: target.arrayName,
      index,
    }
  }

  private writeSharedMemoryLocation(
    location: MemoryLocation,
    value: RuntimeValue,
  ): void {
    if (location.type === 'VARIABLE') {
      this.state.program.sharedMemory[
        location.name
      ] = structuredClone(value)

      return
    }

    if (location.type === 'RECORD_FIELD') {
      const record = this.state.program.sharedMemory[
        location.recordName
      ]

      if (!isRecordValue(record)) {
        throw new Error(
          `Shared variable "${location.recordName}" is not a record`,
        )
      }

      if (!(location.fieldName in record.fields)) {
        throw new Error(
          `Record "${record.recordType}" has no field "${location.fieldName}"`,
        )
      }

      const previousValue = record.fields[location.fieldName]

      if (
        !isPrimitiveValue(value)
        || typeof value !== typeof previousValue
      ) {
        throw new Error(
          `Field "${location.recordName}.${location.fieldName}" requires ${typeof previousValue} but received ${typeof value}`,
        )
      }

      record.fields[location.fieldName] = structuredClone(value)
      return
    }

    const array =
      this.state.program.sharedMemory[
        location.arrayName
      ]

    if (!Array.isArray(array)) {
      throw new Error(
        `Shared variable "${location.arrayName}" is not an array`,
      )
    }

    if (
      location.index < 0
      || location.index >= array.length
    ) {
      throw new Error(
        `Array index ${location.index} is out of bounds`,
      )
    }

    if (location.type === 'ARRAY_RECORD_FIELD') {
      const record = array[location.index]

      if (!isRecordValue(record)) {
        throw new Error(
          `Array element "${location.arrayName}[${location.index}]" is not a record`,
        )
      }

      if (!(location.fieldName in record.fields)) {
        throw new Error(
          `Record "${record.recordType}" has no field "${location.fieldName}"`,
        )
      }

      const previousValue = record.fields[location.fieldName]

      if (
        !isPrimitiveValue(value)
        || typeof value !== typeof previousValue
      ) {
        throw new Error(
          `Field "${location.arrayName}[${location.index}].${location.fieldName}" requires ${typeof previousValue} but received ${typeof value}`,
        )
      }

      record.fields[location.fieldName] = structuredClone(value)
      return
    }

    assertArrayElementCompatible(
      array[location.index],
      value,
      `${location.arrayName}[${location.index}]`,
    )

    array[location.index] = structuredClone(value)
  }

  private evaluateAwaitCondition(
    process: Process,
    condition: Expression,
  ): boolean {
    if (this.containsFunctionCall(condition)) {
      throw new Error(
        'Function calls inside AWAIT conditions are not supported yet',
      )
    }

    const value = evaluateExpression(
      condition,
      {
        localMemory:
          this.getActiveLocalMemory(process),
        sharedMemory:
          this.state.program.sharedMemory,
      },
    )

    if (typeof value !== 'boolean') {
      throw new Error(
        'AWAIT condition must evaluate to boolean',
      )
    }

    return value
  }

  private reevaluateBlockedProcesses(): void {
    for (
      const process
      of this.state.program.processes
    ) {
      if (
        process.state !== 'BLOCKED'
        || !process.blockingReason
      ) {
        continue
      }

      if (this.isBlockingReasonEnabled(process)) {
        process.state = 'READY'

        if (
          process.blockingReason.type !== 'SEMAPHORE_P'
          && process.blockingReason.type
            !== 'MONITOR_CONDITION'
        ) {
          process.blockingReason = undefined
        }
      }
    }
  }

  private findActiveAtomicProcess():
    Process | undefined {
    return this.state.program.processes.find(
      (process) =>
        process.state === 'READY'
        && process.atomicDepth > 0,
    )
  }

  private isProcessLogicallyEnabled(
    process: Process,
  ): boolean {
    if (process.state === 'READY') {
      return true
    }

    return process.state === 'BLOCKED'
      && Boolean(process.blockingReason)
      && this.isBlockingReasonEnabled(process)
  }

  private isBlockingReasonEnabled(
    process: Process,
  ): boolean {
    const reason = process.blockingReason

    if (!reason) {
      return false
    }

    switch (reason.type) {
      case 'AWAIT':
        return this.evaluateAwaitCondition(
          process,
          reason.condition,
        )

      case 'SEMAPHORE_P':
        return this.getSemaphore(
          reason.semaphoreName,
        ).value > 0

      case 'MONITOR_ENTRY':
        return this.getMonitorRuntime(
          reason.monitorName,
        ).ownerProcessId === undefined

      case 'MONITOR_CONDITION':
        return reason.phase === 'REACQUIRE'
          && this.getMonitorRuntime(
            reason.monitorName,
          ).ownerProcessId === undefined
    }
  }

  private executeMonitorProcedureCall(
    process: Process,
    instruction: Extract<
      Instruction,
      { type: 'MONITOR_PROCEDURE_CALL' }
    >,
  ): { readonly description: string } {
    const definition = this.state.program.monitors?.[
      instruction.monitorName
    ]
    const procedure = definition?.procedures[
      instruction.procedureName
    ]

    if (!definition) {
      throw new Error(
        `Monitor "${instruction.monitorName}" is not defined`,
      )
    }

    if (!procedure) {
      throw new Error(
        `Monitor "${instruction.monitorName}" has no procedure "${instruction.procedureName}"`,
      )
    }

    if (
      instruction.arguments.length
      !== procedure.parameters.length
    ) {
      throw new Error(
        `Monitor procedure "${instruction.monitorName}.${instruction.procedureName}" expects ${procedure.parameters.length} arguments but received ${instruction.arguments.length}`,
      )
    }

    const request = process.pendingMonitorEntry
      ?? this.prepareMonitorEntryRequest(
        process,
        instruction,
        procedure.parameters,
      )

    if (
      request.monitorName !== instruction.monitorName
      || request.procedureName !== instruction.procedureName
    ) {
      throw new Error(
        'Pending monitor entry does not match the active instruction',
      )
    }

    const runtime = this.getMonitorRuntime(
      instruction.monitorName,
    )

    if (
      runtime.ownerProcessId
      && runtime.ownerProcessId !== process.id
    ) {
      if (!runtime.entryContenderProcessIds.includes(process.id)) {
        runtime.entryContenderProcessIds.push(process.id)
      }

      process.state = 'BLOCKED'
      process.blockingReason = {
        type: 'MONITOR_ENTRY',
        monitorName: instruction.monitorName,
      }
      process.pendingMonitorEntry = request

      return {
        description: `${instruction.monitorName}.${instruction.procedureName}() blocked: monitor owned by ${runtime.ownerProcessId}`,
      }
    }

    if (runtime.ownerProcessId === process.id) {
      throw new Error(
        `Monitor "${instruction.monitorName}" does not support reentrant calls`,
      )
    }

    runtime.ownerProcessId = process.id
    runtime.entryContenderProcessIds.splice(
      runtime.entryContenderProcessIds.indexOf(process.id),
      runtime.entryContenderProcessIds.includes(process.id) ? 1 : 0,
    )
    process.blockingReason = undefined
    process.pendingMonitorEntry = undefined
    process.monitorCallStack ??= []
    process.monitorCallStack.push({
      monitorName: instruction.monitorName,
      procedureName: instruction.procedureName,
      localMemory: {
        ...structuredClone(runtime.memory),
        ...structuredClone(request.parameterMemory),
      },
      outputBindings: structuredClone(request.outputBindings),
    })

    if (procedure.body.length === 0) {
      this.completeMonitorProcedure(process)
    } else {
      process.executionStack.push({
        instructions: procedure.body,
        programCounter: 0,
        completionMode: 'MONITOR_RETURN',
      })
    }

    return {
      description: `${instruction.monitorName}.${instruction.procedureName}() acquired monitor`,
    }
  }

  private executeMonitorWait(
    process: Process,
    conditionName: string,
  ): {
    readonly description: string
    readonly event: MonitorConditionExecutionEvent
  } {
    const { frame, runtime, condition } =
      this.getActiveMonitorConditionContext(
        process,
        conditionName,
      )
    const waitingProcessIdsBefore = structuredClone(
      condition.waitingProcessIds,
    )
    const blockingReason = process.blockingReason

    if (blockingReason?.type === 'MONITOR_CONDITION') {
      if (
        blockingReason.monitorName !== frame.monitorName
        || blockingReason.conditionName !== conditionName
        || blockingReason.phase !== 'REACQUIRE'
      ) {
        throw new Error(
          'Pending monitor condition wait does not match the active instruction',
        )
      }

      if (
        runtime.ownerProcessId
        && runtime.ownerProcessId !== process.id
      ) {
        this.addMonitorEntryContender(
          runtime,
          process.id,
        )
        process.state = 'BLOCKED'

        return {
          description:
            `${process.id} was signaled on ${frame.monitorName}.${conditionName} but the monitor is owned by ${runtime.ownerProcessId}`,
          event: {
            operation: 'WAIT',
            monitorName: frame.monitorName,
            conditionName,
            status: 'REENTRY_BLOCKED',
            awakenedProcessIds: [],
            waitingProcessIdsBefore,
            waitingProcessIdsAfter: structuredClone(
              condition.waitingProcessIds,
            ),
          },
        }
      }

      runtime.ownerProcessId = process.id
      this.removeMonitorEntryContender(
        runtime,
        process.id,
      )
      this.refreshMonitorFrameState(frame, runtime)
      process.blockingReason = undefined
      this.advanceProcess(process)

      return {
        description:
          `${process.id} reacquired ${frame.monitorName} after wait(${conditionName})`,
        event: {
          operation: 'WAIT',
          monitorName: frame.monitorName,
          conditionName,
          status: 'REACQUIRED',
          awakenedProcessIds: [],
          waitingProcessIdsBefore,
          waitingProcessIdsAfter: structuredClone(
            condition.waitingProcessIds,
          ),
        },
      }
    }

    if (runtime.ownerProcessId !== process.id) {
      throw new Error(
        `Process "${process.id}" does not own monitor "${frame.monitorName}"`,
      )
    }

    if (condition.waitingProcessIds.includes(process.id)) {
      throw new Error(
        `Process "${process.id}" is already waiting on condition "${conditionName}"`,
      )
    }

    this.copyMonitorState(frame.localMemory, runtime)
    condition.waitingProcessIds.push(process.id)
    runtime.ownerProcessId = undefined
    process.state = 'BLOCKED'
    process.blockingReason = {
      type: 'MONITOR_CONDITION',
      monitorName: frame.monitorName,
      conditionName,
      phase: 'WAITING',
    }

    return {
      description:
        `${process.id} waits on ${frame.monitorName}.${conditionName} and releases the monitor`,
      event: {
        operation: 'WAIT',
        monitorName: frame.monitorName,
        conditionName,
        status: 'WAITING',
        awakenedProcessIds: [],
        waitingProcessIdsBefore,
        waitingProcessIdsAfter: structuredClone(
          condition.waitingProcessIds,
        ),
      },
    }
  }

  private executeMonitorSignal(
    process: Process,
    conditionName: string,
    broadcast: boolean,
  ): {
    readonly description: string
    readonly event: MonitorConditionExecutionEvent
  } {
    const { frame, runtime, condition } =
      this.getActiveMonitorConditionContext(
        process,
        conditionName,
      )

    if (runtime.ownerProcessId !== process.id) {
      throw new Error(
        `Process "${process.id}" does not own monitor "${frame.monitorName}"`,
      )
    }

    const waitingProcessIdsBefore = structuredClone(
      condition.waitingProcessIds,
    )
    const awakenedProcessIds = broadcast
      ? condition.waitingProcessIds.splice(0)
      : condition.waitingProcessIds.splice(0, 1)

    for (const processId of awakenedProcessIds) {
      this.prepareConditionWaiterForReentry(
        frame.monitorName,
        conditionName,
        processId,
        runtime,
      )
    }

    this.advanceProcess(process)

    const operation = broadcast
      ? 'SIGNAL_ALL' as const
      : 'SIGNAL' as const
    const status = awakenedProcessIds.length > 0
      ? 'SIGNALED' as const
      : 'NO_WAITER' as const
    const awakenedDescription = awakenedProcessIds.length > 0
      ? `woke ${awakenedProcessIds.join(', ')}`
      : 'had no waiting process'

    return {
      description:
        `${monitorConditionOperationName(operation)}(${conditionName}) ${awakenedDescription}; signaler continues in ${frame.monitorName}`,
      event: {
        operation,
        monitorName: frame.monitorName,
        conditionName,
        status,
        awakenedProcessIds: structuredClone(
          awakenedProcessIds,
        ),
        waitingProcessIdsBefore,
        waitingProcessIdsAfter: structuredClone(
          condition.waitingProcessIds,
        ),
      },
    }
  }

  private getActiveMonitorConditionContext(
    process: Process,
    conditionName: string,
  ) {
    const frame = process.monitorCallStack?.at(-1)

    if (!frame) {
      throw new Error(
        'Monitor condition operations require an active monitor procedure',
      )
    }

    const runtime = this.getMonitorRuntime(
      frame.monitorName,
    )
    const condition = runtime.conditions[conditionName]

    if (!condition) {
      throw new Error(
        `Condition "${conditionName}" is not defined in monitor "${frame.monitorName}"`,
      )
    }

    return {
      frame,
      runtime,
      condition,
    }
  }

  private prepareConditionWaiterForReentry(
    monitorName: string,
    conditionName: string,
    processId: string,
    runtime: MonitorRuntimeState,
  ): void {
    const waiter = this.state.program.processes.find(
      (process) => process.id === processId,
    )

    if (
      !waiter
      || waiter.state !== 'BLOCKED'
      || waiter.blockingReason?.type
        !== 'MONITOR_CONDITION'
      || waiter.blockingReason.monitorName !== monitorName
      || waiter.blockingReason.conditionName !== conditionName
      || waiter.blockingReason.phase !== 'WAITING'
    ) {
      throw new Error(
        `Condition "${monitorName}.${conditionName}" contains invalid waiter "${processId}"`,
      )
    }

    waiter.blockingReason = {
      type: 'MONITOR_CONDITION',
      monitorName,
      conditionName,
      phase: 'REACQUIRE',
    }
    this.addMonitorEntryContender(runtime, processId)
  }

  private addMonitorEntryContender(
    runtime: MonitorRuntimeState,
    processId: string,
  ): void {
    if (!runtime.entryContenderProcessIds.includes(processId)) {
      runtime.entryContenderProcessIds.push(processId)
    }
  }

  private removeMonitorEntryContender(
    runtime: MonitorRuntimeState,
    processId: string,
  ): void {
    const index = runtime.entryContenderProcessIds.indexOf(
      processId,
    )

    if (index >= 0) {
      runtime.entryContenderProcessIds.splice(index, 1)
    }
  }

  private completeMonitorProcedure(
    process: Process,
  ): void {
    const frame = process.monitorCallStack?.at(-1)

    if (!frame) {
      throw new Error(
        'Monitor call stack is empty',
      )
    }

    const runtime = this.getMonitorRuntime(frame.monitorName)

    if (runtime.ownerProcessId !== process.id) {
      throw new Error(
        `Process "${process.id}" does not own monitor "${frame.monitorName}"`,
      )
    }


    const outputValues = frame.outputBindings.map(
      (binding) => {
        const value = frame.localMemory[binding.parameterName]

        if (value === undefined) {
          throw new Error(
            `OUT parameter "${binding.parameterName}" is missing from the monitor frame`,
          )
        }

        if (isUninitializedOutValue(value)) {
          throw new Error(
            `OUT parameter "${binding.parameterName}" must be assigned before procedure returns`,
          )
        }

        if (!valueMatchesDeclaredType(value, binding.declaredType)) {
          throw new Error(
            `OUT parameter "${binding.parameterName}" requires ${formatDeclaredType(binding.declaredType)} but received ${describeRuntimeType(value)}`,
          )
        }

        const callerMemory = this.getCapturedMonitorCallerMemory(
          process,
          binding.callerMemory,
        )

        this.assertMonitorOutputTargetCompatible(
          callerMemory,
          binding,
          value,
        )

        return {
          binding,
          callerMemory,
          value: structuredClone(value),
        }
      },
    )

    this.copyMonitorState(frame.localMemory, runtime)

    for (const output of outputValues) {
      this.writeResolvedMonitorOutput(
        output.callerMemory,
        output.binding.target,
        output.value,
      )
    }

    process.monitorCallStack?.pop()
    runtime.ownerProcessId = undefined
    this.advanceProcess(process)
  }

  private prepareMonitorEntryRequest(
    process: Process,
    instruction: Extract<
      Instruction,
      { type: 'MONITOR_PROCEDURE_CALL' }
    >,
    parameters: NonNullable<
      ExecutionState['program']['monitors']
    >[string]['procedures'][string]['parameters'],
  ): MonitorEntryRequest {
    const parameterMemory: Record<string, RuntimeValue> = {}
    const outputBindings: MonitorOutputBinding[] = []
    const callerMemory = this.captureMonitorCallerMemory(process)
    const activeMemory = this.getCapturedMonitorCallerMemory(
      process,
      callerMemory,
    )

    parameters.forEach((parameter, index) => {
      const argument = instruction.arguments[index]

      if (!argument || argument.mode !== parameter.mode) {
        throw new Error(
          `Argument ${index + 1} of "${instruction.monitorName}.${instruction.procedureName}" must be ${parameter.mode.toLowerCase()}`,
        )
      }

      if (argument.mode === 'IN') {
        if (this.containsFunctionCall(argument.expression)) {
          throw new Error(
            `Function calls inside monitor in parameter "${parameter.name}" are not supported yet; store the result in local memory first`,
          )
        }

        if (this.findNextSharedMemoryRead(process, argument.expression)) {
          throw new Error(
            `Shared-memory reads inside monitor in parameter "${parameter.name}" are not supported yet; copy the value to local memory first`,
          )
        }

        const value = evaluateExpression(argument.expression, {
          localMemory: activeMemory,
          sharedMemory: this.state.program.sharedMemory,
        })

        if (!valueMatchesDeclaredType(value, parameter.declaredType)) {
          throw new Error(
            `IN parameter "${parameter.name}" requires ${formatDeclaredType(parameter.declaredType)} but received ${describeRuntimeType(value)}`,
          )
        }

        parameterMemory[parameter.name] = structuredClone(value)
        return
      }

      const target = this.resolveMonitorOutputTarget(
        process,
        activeMemory,
        argument.target,
        parameter.name,
      )
      const currentValue = this.readResolvedMonitorOutput(
        activeMemory,
        target,
      )

      if (!this.valueOrUninitializedVariableMatchesType(
        currentValue,
        parameter.declaredType,
      )) {
        throw new Error(
          `OUT parameter "${parameter.name}" requires a ${formatDeclaredType(parameter.declaredType)} target but received ${describeRuntimeType(currentValue)}`,
        )
      }

      parameterMemory[parameter.name] =
        createUninitializedOutValue(parameter.name)
      outputBindings.push({
        parameterName: parameter.name,
        declaredType: parameter.declaredType,
        callerMemory,
        target,
      })
    })

    return {
      monitorName: instruction.monitorName,
      procedureName: instruction.procedureName,
      parameterMemory,
      outputBindings,
    }
  }

  private captureMonitorCallerMemory(
    process: Process,
  ): MonitorCallerMemory {
    for (
      let index = process.executionStack.length - 1;
      index >= 0;
      index--
    ) {
      const mode = process.executionStack[index].completionMode

      if (mode === 'FUNCTION_RETURN') {
        return {
          kind: 'FUNCTION',
          frameIndex: process.callStack.length - 1,
        }
      }

      if (mode === 'MONITOR_RETURN') {
        return {
          kind: 'MONITOR',
          frameIndex: (process.monitorCallStack?.length ?? 0) - 1,
        }
      }
    }

    return { kind: 'PROCESS' }
  }

  private getCapturedMonitorCallerMemory(
    process: Process,
    caller: MonitorCallerMemory,
  ): Record<string, RuntimeValue> {
    if (caller.kind === 'PROCESS') {
      return process.localMemory
    }

    const memory = caller.kind === 'FUNCTION'
      ? process.callStack[caller.frameIndex]?.localMemory
      : process.monitorCallStack?.[caller.frameIndex]?.localMemory

    if (!memory) {
      throw new Error(
        'Monitor OUT destination frame is no longer available',
      )
    }

    return memory
  }

  private resolveMonitorOutputTarget(
    process: Process,
    localMemory: Record<string, RuntimeValue>,
    target: AssignmentTarget,
    parameterName: string,
  ): ResolvedMonitorOutputTarget {
    const rootName = target.type === 'VARIABLE'
      ? target.name
      : target.type === 'RECORD_FIELD'
        ? target.recordName
        : target.arrayName

    if (!(rootName in localMemory)) {
      if (rootName in this.state.program.sharedMemory) {
        throw new Error(
          `OUT parameter "${parameterName}" must target local memory; "${rootName}" is shared`,
        )
      }

      throw new Error(
        `OUT target "${rootName}" is not defined in local memory`,
      )
    }

    if (
      target.type === 'VARIABLE'
      || target.type === 'RECORD_FIELD'
    ) {
      return target
    }

    if (this.containsFunctionCall(target.index)) {
      throw new Error(
        `Function calls inside OUT target for "${parameterName}" are not supported yet`,
      )
    }

    if (this.findNextSharedMemoryRead(process, target.index)) {
      throw new Error(
        `Shared-memory reads inside OUT target for "${parameterName}" are not supported yet`,
      )
    }

    const index = evaluateExpression(target.index, {
      localMemory,
      sharedMemory: this.state.program.sharedMemory,
    })

    if (typeof index !== 'number' || !Number.isInteger(index)) {
      throw new Error('Array index must be an integer')
    }

    return {
      ...target,
      index,
    }
  }

  private readResolvedMonitorOutput(
    memory: Record<string, RuntimeValue>,
    target: ResolvedMonitorOutputTarget,
  ): RuntimeValue {
    if (target.type === 'VARIABLE') {
      return memory[target.name]
    }

    if (target.type === 'RECORD_FIELD') {
      const record = memory[target.recordName]

      if (!isRecordValue(record)) {
        throw new Error(
          `Variable "${target.recordName}" is not a record`,
        )
      }

      if (!(target.fieldName in record.fields)) {
        throw new Error(
          `Record "${record.recordType}" has no field "${target.fieldName}"`,
        )
      }

      return record.fields[target.fieldName]
    }

    const array = memory[target.arrayName]

    if (!Array.isArray(array)) {
      throw new Error(
        `Variable "${target.arrayName}" is not an array`,
      )
    }

    if (target.index < 0 || target.index >= array.length) {
      throw new Error(
        `Array index ${target.index} is out of bounds`,
      )
    }

    const value = array[target.index]

    if (target.type === 'ARRAY_ACCESS') {
      return value
    }

    if (!isRecordValue(value)) {
      throw new Error(
        `Array element "${target.arrayName}[${target.index}]" is not a record`,
      )
    }

    if (!(target.fieldName in value.fields)) {
      throw new Error(
        `Record "${value.recordType}" has no field "${target.fieldName}"`,
      )
    }

    return value.fields[target.fieldName]
  }

  private assertMonitorOutputTargetCompatible(
    memory: Record<string, RuntimeValue>,
    binding: MonitorOutputBinding,
    value: RuntimeValue,
  ): void {
    const currentValue = this.readResolvedMonitorOutput(
      memory,
      binding.target,
    )

    if (!this.valueOrUninitializedVariableMatchesType(
      currentValue,
      binding.declaredType,
    )) {
      throw new Error(
        `OUT target for "${binding.parameterName}" changed to incompatible type ${describeRuntimeType(currentValue)}`,
      )
    }

    if (
      binding.target.type === 'ARRAY_ACCESS'
    ) {
      if (
        !isPrimitiveValue(currentValue)
        && !isRecordValue(currentValue)
      ) {
        throw new Error(
          `OUT target for "${binding.parameterName}" is not an array element value`,
        )
      }

      assertArrayElementCompatible(
        currentValue,
        value,
        `${binding.target.arrayName}[${binding.target.index}]`,
      )
      return
    }

    if (
      binding.target.type === 'RECORD_FIELD'
      || binding.target.type === 'ARRAY_RECORD_FIELD'
    ) {
      if (
        !isPrimitiveValue(value)
        || !isPrimitiveValue(currentValue)
        || typeof value !== typeof currentValue
      ) {
        throw new Error(
          `OUT field target for "${binding.parameterName}" has an incompatible type`,
        )
      }
    }
  }

  private writeResolvedMonitorOutput(
    memory: Record<string, RuntimeValue>,
    target: ResolvedMonitorOutputTarget,
    value: RuntimeValue,
  ): void {
    if (target.type === 'VARIABLE') {
      memory[target.name] = structuredClone(value)
      return
    }

    if (target.type === 'RECORD_FIELD') {
      const record = memory[target.recordName]

      if (!isRecordValue(record) || !isPrimitiveValue(value)) {
        throw new Error('Invalid record OUT write-back')
      }

      record.fields[target.fieldName] = structuredClone(value)
      return
    }

    const array = memory[target.arrayName]

    if (!Array.isArray(array)) {
      throw new Error('Invalid array OUT write-back')
    }

    if (target.type === 'ARRAY_ACCESS') {
      if (!isPrimitiveValue(value) && !isRecordValue(value)) {
        throw new Error('Invalid array element OUT write-back')
      }

      array[target.index] = structuredClone(value)
      return
    }

    const record = array[target.index]

    if (!isRecordValue(record) || !isPrimitiveValue(value)) {
      throw new Error('Invalid record field OUT write-back')
    }

    record.fields[target.fieldName] = structuredClone(value)
  }

  private valueOrUninitializedVariableMatchesType(
    value: RuntimeValue,
    declaredType: DeclaredType,
  ): boolean {
    return isUninitializedVariableValue(value)
      ? declaredTypesEqual(value.declaredType, declaredType)
      : valueMatchesDeclaredType(value, declaredType)
  }

  private assertDeclarationValue(
    variableName: string,
    declaredType: DeclaredType,
    value: RuntimeValue,
  ): void {
    if (!valueMatchesDeclaredType(value, declaredType)) {
      throw new Error(
        `Variable "${variableName}" requires ${formatDeclaredType(declaredType)} but received ${describeRuntimeType(value)}`,
      )
    }
  }

  private syncActiveMonitorState(
    process: Process,
  ): void {
    for (
      let index = process.executionStack.length - 1;
      index >= 0;
      index--
    ) {
      const mode = process.executionStack[index].completionMode

      if (mode === 'FUNCTION_RETURN') {
        return
      }

      if (mode === 'MONITOR_RETURN') {
        const frame = process.monitorCallStack?.at(-1)

        if (frame) {
          this.copyMonitorState(
            frame.localMemory,
            this.getMonitorRuntime(frame.monitorName),
          )
        }

        return
      }
    }
  }

  private copyMonitorState(
    source: Record<string, RuntimeValue>,
    runtime: MonitorRuntimeState,
  ): void {
    const definition = this.state.program.monitors?.[
      runtime.definitionName
    ]

    if (!definition) {
      throw new Error(
        `Monitor "${runtime.definitionName}" is not defined`,
      )
    }

    for (const state of definition.state) {
      if (!(state.name in source)) {
        throw new Error(
          `Monitor state "${state.name}" is missing from the active frame`,
        )
      }

      runtime.memory[state.name] = structuredClone(
        source[state.name],
      )
    }
  }

  private refreshMonitorFrameState(
    frame: NonNullable<Process['monitorCallStack']>[number],
    runtime: MonitorRuntimeState,
  ): void {
    const definition = this.state.program.monitors?.[
      runtime.definitionName
    ]

    if (!definition) {
      throw new Error(
        `Monitor "${runtime.definitionName}" is not defined`,
      )
    }

    for (const state of definition.state) {
      if (!(state.name in runtime.memory)) {
        throw new Error(
          `Monitor state "${state.name}" is missing from runtime`,
        )
      }

      frame.localMemory[state.name] = structuredClone(
        runtime.memory[state.name],
      )
    }
  }

  private getMonitorRuntime(
    monitorName: string,
  ): MonitorRuntimeState {
    const runtime = this.state.monitorStates?.[monitorName]

    if (!runtime) {
      throw new Error(
        `Monitor runtime "${monitorName}" is not initialized`,
      )
    }

    return runtime
  }

  private executeSimulatedOperation(
    process: Process,
    instruction: Extract<
      Instruction,
      { type: 'SIMULATED_OPERATION' }
    >,
  ): {
    readonly event?: SimulatedOperationExecutionEvent
    readonly description?: string
  } {
    let runtime = process.microOperationRuntime

    if (!runtime) {
      if (instruction.arguments.some(
        (argument) => this.containsFunctionCall(argument),
      )) {
        throw new Error(
          `Function calls inside ${instruction.operationName}() are not supported yet`,
        )
      }

      const receiver = instruction.receiverName
        ? this.resolveSimulatedOperationReceiver(
            process,
            instruction.receiverName,
            instruction.operationName,
          )
        : undefined

      runtime = {
        type: 'SIMULATED_OPERATION',
        instruction,
        pendingArguments:
          structuredClone(instruction.arguments),
        argumentIndex: 0,
        argumentValues: [],
        receiver,
      }
      process.microOperationRuntime = runtime
    }

    if (runtime.type !== 'SIMULATED_OPERATION') {
      throw new Error(
        'Invalid simulated-operation runtime',
      )
    }

    while (
      runtime.argumentIndex
      < runtime.pendingArguments.length
    ) {
      const argument = runtime.pendingArguments[
        runtime.argumentIndex
      ]
      const read = this.findNextSharedMemoryRead(
        process,
        argument,
      )

      if (read) {
        const value = this.readSharedMemoryLocation(
          read.location,
        )
        const locationDescription =
          this.formatMemoryLocation(read.location)

        this.recordMicroOperation(
          process,
          'SHARED_READ',
          `${locationDescription} = ${JSON.stringify(value)}`,
          read.location,
        )
        runtime.pendingArguments[
          runtime.argumentIndex
        ] = this.replaceExpressionWithValue(
          argument,
          read.expression,
          value,
        )

        return {}
      }

      const value = evaluateExpression(
        argument,
        {
          localMemory:
            this.getActiveLocalMemory(process),
          sharedMemory:
            this.state.program.sharedMemory,
        },
      )

      runtime.argumentValues.push(
        structuredClone(value),
      )
      this.recordMicroOperation(
        process,
        'COMPUTE',
        `argument ${runtime.argumentIndex + 1} = ${JSON.stringify(value)}`,
      )
      runtime.argumentIndex++
    }

    const argumentValues = structuredClone(
      runtime.argumentValues,
    )
    const description = `${runtime.receiver
      ? `${runtime.receiver.name}.`
      : ''}${instruction.operationName}(${argumentValues
      .map((value) => JSON.stringify(value))
      .join(', ')})`

    this.recordMicroOperation(
      process,
      'INSTRUCTION',
      description,
    )
    process.microOperationRuntime = undefined
    this.advanceProcess(process)

    return {
      event: {
        operationName: instruction.operationName,
        arguments: argumentValues,
        receiver: runtime.receiver,
      },
      description,
    }
  }

  private resolveSimulatedOperationReceiver(
    process: Process,
    receiverName: string,
    operationName: string,
  ): NonNullable<
    SimulatedOperationExecutionEvent['receiver']
  > {
    const localMemory =
      this.getActiveLocalMemory(process)
    const scope = receiverName in localMemory
      ? 'LOCAL'
      : 'SHARED'
    const value = scope === 'LOCAL'
      ? localMemory[receiverName]
      : this.state.program.sharedMemory[receiverName]

    if (value === undefined) {
      throw new Error(
        `Variable "${receiverName}" is not defined`,
      )
    }

    if (!isRecordValue(value)) {
      throw new Error(
        `Simulated method "${operationName}" requires record receiver "${receiverName}"`,
      )
    }

    return {
      name: receiverName,
      recordType: value.recordType,
      scope,
    }
  }

  private executeDataStructureOperation(
    process: Process,
    instruction: DataStructureOperationInstruction,
  ): {
    readonly event: DataStructureExecutionEvent
    readonly description: string
  } {
    const resolved = this.resolveDataStructure(
      process,
      instruction.structureName,
    )
    const operationReturnsValue =
      instruction.operation !== 'ENQUEUE'
      && instruction.operation !== 'PUSH'

    if (operationReturnsValue) {
      this.validateDataStructureResultTarget(
        process,
        instruction,
        resolved.structure,
      )
    }

    const sizeBefore = resolved.structure.items.length
    let value: RuntimeValue
    let priority: number | undefined

    switch (instruction.operation) {
      case 'ENQUEUE': {
        if (isStackValue(resolved.structure)) {
          throw new Error('enqueue() requires a queue')
        }

        const evaluated = this.evaluateDataStructureArgument(
          process,
          instruction,
          'enqueue',
        )
        assertCollectionElementType(
          evaluated,
          resolved.structure.elementType,
          isPriorityQueueValue(resolved.structure)
            ? 'PriorityQueue'
            : 'Queue',
        )
        value = evaluated

        if (isPriorityQueueValue(resolved.structure)) {
          if (!instruction.priorityArgument) {
            throw new Error(
              'priority_queue.enqueue() requires a value and an integer priority',
            )
          }

          const evaluatedPriority =
            this.evaluateDataStructureExpression(
              process,
              instruction.priorityArgument,
              'enqueue',
            )
          assertPriority(evaluatedPriority)
          priority = evaluatedPriority
          enqueuePriorityItem(resolved.structure, {
            value,
            priority,
          })
        } else {
          if (instruction.priorityArgument) {
            throw new Error(
              'queue.enqueue() accepts only one value; priorities require priority_queue',
            )
          }

          resolved.structure.items.push(
            structuredClone(value),
          )
        }

        this.advanceProcess(process)
        break
      }

      case 'PUSH': {
        if (!isStackValue(resolved.structure)) {
          throw new Error('push() requires a stack')
        }

        const evaluated = this.evaluateDataStructureArgument(
          process,
          instruction,
          'push',
        )
        assertCollectionElementType(
          evaluated,
          resolved.structure.elementType,
          'Stack',
        )
        value = evaluated
        resolved.structure.items.push(
          structuredClone(value),
        )
        this.advanceProcess(process)
        break
      }

      case 'DEQUEUE':
      case 'FRONT': {
        if (isStackValue(resolved.structure)) {
          throw new Error(
            `${dataStructureMethodName(instruction.operation)}() requires a queue`,
          )
        }

        value = this.requireQueueFront(
          instruction.structureName,
          resolved.structure,
          instruction.operation === 'DEQUEUE'
            ? 'dequeue'
            : 'front',
        )

        if (instruction.operation === 'DEQUEUE') {
          resolved.structure.items.shift()
        }

        this.completeDataStructureResult(
          process,
          instruction,
          value,
        )
        break
      }

      case 'POP':
      case 'TOP': {
        if (!isStackValue(resolved.structure)) {
          throw new Error(
            `${dataStructureMethodName(instruction.operation)}() requires a stack`,
          )
        }

        value = this.requireStackTop(
          instruction.structureName,
          resolved.structure,
          instruction.operation === 'POP'
            ? 'pop'
            : 'top',
        )

        if (instruction.operation === 'POP') {
          resolved.structure.items.pop()
        }

        this.completeDataStructureResult(
          process,
          instruction,
          value,
        )
        break
      }

      case 'IS_EMPTY': {
        value = resolved.structure.items.length === 0
        this.completeDataStructureResult(
          process,
          instruction,
          value,
        )
        break
      }

      case 'SIZE': {
        value = resolved.structure.items.length
        this.completeDataStructureResult(
          process,
          instruction,
          value,
        )
        break
      }
    }

    const sizeAfter = resolved.structure.items.length
    const method = dataStructureMethodName(
      instruction.operation,
    )
    const renderedValue = JSON.stringify(value)
    const isInsertion =
      instruction.operation === 'ENQUEUE'
      || instruction.operation === 'PUSH'

    return {
      event: {
        operation: instruction.operation,
        structureName: instruction.structureName,
        structureKind: isStackValue(resolved.structure)
          ? 'STACK'
          : isPriorityQueueValue(resolved.structure)
            ? 'PRIORITY_QUEUE'
            : 'FIFO_QUEUE',
        scope: resolved.scope,
        sizeBefore,
        sizeAfter,
        value,
        priority,
      },
      description: isInsertion
        ? `${instruction.structureName}.${method}(${renderedValue}${priority === undefined ? '' : `, ${priority}`}): size ${sizeBefore} -> ${sizeAfter}`
        : `${instruction.structureName}.${method}() = ${renderedValue}: size ${sizeBefore} -> ${sizeAfter}`,
    }
  }

  private resolveDataStructure(
    process: Process,
    structureName: string,
  ): {
    readonly structure:
      | QueueValue
      | PriorityQueueValue
      | StackValue
    readonly scope: 'LOCAL' | 'SHARED'
  } {
    const localMemory = this.getActiveLocalMemory(process)

    if (structureName in localMemory) {
      const value = localMemory[structureName]

      if (!isDataStructureValue(value)) {
        throw new Error(
          `Variable "${structureName}" is not a supported data structure`,
        )
      }

      return { structure: value, scope: 'LOCAL' }
    }

    const value = this.state.program.sharedMemory[structureName]

    if (value === undefined) {
      throw new Error(
        `Data structure "${structureName}" is not defined`,
      )
    }

    if (!isDataStructureValue(value)) {
      throw new Error(
        `Variable "${structureName}" is not a supported data structure`,
      )
    }

    return { structure: value, scope: 'SHARED' }
  }

  private requireQueueFront(
    queueName: string,
    queue: QueueValue | PriorityQueueValue,
    method: 'dequeue' | 'front',
  ): CollectionElementValue {
    if (isPriorityQueueValue(queue)) {
      const item = queue.items[0]

      if (item === undefined) {
        throw new Error(
          `Queue "${queueName}" is empty; ${method}() cannot continue`,
        )
      }

      return item.value
    }

    const value = queue.items[0]

    if (value === undefined) {
      throw new Error(
        `Queue "${queueName}" is empty; ${method}() cannot continue`,
      )
    }

    return value
  }

  private requireStackTop(
    stackName: string,
    stack: StackValue,
    method: 'pop' | 'top',
  ): CollectionElementValue {
    const value = stack.items.at(-1)

    if (value === undefined) {
      throw new Error(
        `Stack "${stackName}" is empty; ${method}() cannot continue`,
      )
    }

    return value
  }

  private evaluateDataStructureArgument(
    process: Process,
    instruction: DataStructureOperationInstruction,
    method: 'enqueue' | 'push',
  ): RuntimeValue {
    if (!instruction.argument) {
      throw new Error(`${method}() requires one argument`)
    }

    return this.evaluateDataStructureExpression(
      process,
      instruction.argument,
      method,
    )
  }

  private evaluateDataStructureExpression(
    process: Process,
    expression: Expression,
    method: 'enqueue' | 'push',
  ): RuntimeValue {
    if (this.containsFunctionCall(expression)) {
      throw new Error(
        `Function calls inside ${method}() are not supported yet`,
      )
    }

    if (this.findNextSharedMemoryRead(process, expression)) {
      throw new Error(
        `Shared-memory reads inside ${method}() are not supported yet; copy the value to local memory first`,
      )
    }

    return evaluateExpression(expression, {
      localMemory: this.getActiveLocalMemory(process),
      sharedMemory: this.state.program.sharedMemory,
    })
  }

  private completeDataStructureResult(
    process: Process,
    instruction: DataStructureOperationInstruction,
    value: RuntimeValue,
  ): void {
    const target = instruction.resultTarget

    if (!target) {
      throw new Error(
        'Missing validated data structure result target',
      )
    }

    if (target.type === 'DECLARE') {
      this.getActiveLocalMemory(process)[
        target.name
      ] = structuredClone(value)
      this.advanceProcess(process)
      return
    }

    this.completeAssignmentValue(
      process,
      target.target,
      structuredClone(value),
    )
  }

  private validateDataStructureResultTarget(
    process: Process,
    instruction: DataStructureOperationInstruction,
    structure: QueueValue | PriorityQueueValue | StackValue,
  ): void {
    const target = instruction.resultTarget

    if (!target) {
      throw new Error(
        `${dataStructureMethodName(instruction.operation)}() result must be assigned`,
      )
    }

    if (
      target.type === 'ASSIGN'
      && this.isSharedAssignmentTarget(
        process,
        target.target,
      )
    ) {
      throw new Error(
        'Data structure operation results must be assigned to local memory',
      )
    }

    if (target.type === 'DECLARE') {
      const expectedType =
        instruction.operation === 'SIZE'
          ? { kind: 'PRIMITIVE', primitiveType: 'int' } as const
          : instruction.operation === 'IS_EMPTY'
            ? { kind: 'PRIMITIVE', primitiveType: 'bool' } as const
            : structure.elementType

      if (!declaredValueTypeMatches(
        target.valueType,
        expectedType,
      )) {
        throw new Error(
          `Variable "${target.name}" is declared as ${formatDeclaredValueType(target.valueType)} but ${dataStructureMethodName(instruction.operation)}() returns ${formatDeclaredValueType(expectedType)}`,
        )
      }
    }
  }

  private getSemaphore(
    semaphoreName: string,
  ) {
    const semaphore =
      this.state.program.semaphores?.[
        semaphoreName
      ]

    if (!semaphore) {
      const isArray = Object.keys(
        this.state.program.semaphores ?? {},
      ).some((name) =>
        name.startsWith(`${semaphoreName}[`),
      )

      if (isArray) {
        throw new Error(
          `Semaphore array "${semaphoreName}" requires an index`,
        )
      }

      throw new Error(
        `Semaphore "${semaphoreName}" is not defined`,
      )
    }

    return semaphore
  }

  private resolveSemaphoreName(
    process: Process,
    instruction: {
      readonly semaphoreName: string
      readonly semaphoreIndex?: Expression
    },
  ): string {
    if (!instruction.semaphoreIndex) {
      return instruction.semaphoreName
    }

    const index = evaluateExpression(
      instruction.semaphoreIndex,
      {
        localMemory:
          this.getActiveLocalMemory(process),
        sharedMemory:
          this.state.program.sharedMemory,
      },
    )

    if (
      typeof index !== 'number'
      || !Number.isInteger(index)
    ) {
      throw new Error(
        'Semaphore index must evaluate to an integer',
      )
    }

    const resolvedName =
      `${instruction.semaphoreName}[${index}]`
    const semaphores =
      this.state.program.semaphores ?? {}
    const hasArrayElements = Object.keys(semaphores)
      .some((name) =>
        name.startsWith(
          `${instruction.semaphoreName}[`,
        ),
      )

    if (!hasArrayElements) {
      if (semaphores[instruction.semaphoreName]) {
        throw new Error(
          `Semaphore "${instruction.semaphoreName}" is not an array`,
        )
      }

      throw new Error(
        `Semaphore array "${instruction.semaphoreName}" is not defined`,
      )
    }

    if (
      index < 0
      || !semaphores[resolvedName]
    ) {
      throw new Error(
        `Semaphore index ${index} is out of bounds for "${instruction.semaphoreName}"`,
      )
    }

    return resolvedName
  }
}

function declaredValueTypeMatches(
  declared: DeclaredValueType,
  actual:
    | DeclaredValueType
    | QueueValue['elementType'],
): boolean {
  if (typeof actual === 'string') {
    return declared.kind === 'PRIMITIVE'
      && declared.primitiveType === actual
  }

  if (actual.kind === 'PRIMITIVE') {
    return declared.kind === 'PRIMITIVE'
      && declared.primitiveType === actual.primitiveType
  }

  return declared.kind === 'RECORD'
    && declared.recordType === actual.recordType
}

function formatDeclaredValueType(
  type: DeclaredValueType | QueueValue['elementType'],
): string {
  if (typeof type === 'string') {
    return type
  }

  return type.kind === 'PRIMITIVE'
    ? type.primitiveType
    : type.recordType
}

function dataStructureMethodName(
  operation: DataStructureOperationInstruction['operation'],
): string {
  switch (operation) {
    case 'ENQUEUE':
      return 'enqueue'
    case 'DEQUEUE':
      return 'dequeue'
    case 'FRONT':
      return 'front'
    case 'PUSH':
      return 'push'
    case 'POP':
      return 'pop'
    case 'TOP':
      return 'top'
    case 'IS_EMPTY':
      return 'isEmpty'
    case 'SIZE':
      return 'size'
  }
}

function monitorConditionOperationName(
  operation: 'SIGNAL' | 'SIGNAL_ALL',
): string {
  return operation.toLocaleLowerCase()
}
