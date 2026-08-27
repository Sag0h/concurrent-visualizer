import type { ExecutionState } from './ExecutionState'
import type { Scheduler } from '../scheduler/Scheduler'
import { evaluateExpression } from '../expressions/evaluateExpression'
import { writeVariable } from '../memory/writeVariable'
import type { SimulationSnapshot } from './SimulationSnapshot'
import type { Process } from '../process/Process'
import type { CallInstruction, ForeachInstruction, IfInstruction, Instruction, WhileInstruction } from '../instructions/Instruction'
import type { ExecutionFrame } from '../process/ExecutionFrame'
import type { RuntimeValue } from '../memory/RuntimeValue'
import type { PendingInstruction } from '../process/PendingInstruction'

import type {
  Expression,
  FunctionCallExpression,
} from '../expressions/Expression'
import type { AssignmentTarget } from '../instructions/AssignmentTarget'
import type { FunctionDefinition } from '../language/FunctionDefinition'
import type { PendingEvaluation } from '../process/PendingEvaluation'

export class SimulationEngine {
  private state: ExecutionState
  private readonly scheduler: Scheduler
  private readonly initialState: ExecutionState
  private readonly maxSteps: number

  constructor(
    state: ExecutionState,
    scheduler: Scheduler,
    maxSteps: number = 10_000,
  ) {
    this.state = state
    this.scheduler = scheduler
    this.initialState = structuredClone(state)
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

  reset(): void {
    this.state = structuredClone(this.initialState)
    this.scheduler.reset()
  }

  hasReachedStepLimit(): boolean {
    return this.state.stepCount >= this.maxSteps
  }

step(): boolean {
  if (this.state.stepCount >= this.maxSteps) {
    return false
  }

  const process = this.scheduler.selectNext(
    this.state.program.processes,
  )

  if (!process) {
    return false
  }

  process.state = 'RUNNING'

  try {
    const instruction =
      this.getCurrentInstruction(process)

    if (!instruction) {
      process.state = 'FINISHED'
      return true
    }

    switch (instruction.type) {
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

        if (instruction.scope === 'LOCAL') {
          this.getActiveLocalMemory(process)[
            instruction.name
          ] = value
        } else {
          this.state.program.sharedMemory[
            instruction.name
          ] = value
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
    }

    this.state.history.push({
      step: this.state.stepCount + 1,
      processId: process.id,
      instructionType: instruction.type,
    })

    this.state.stepCount++

    if (
      process.executionStack.length === 0
      && process.programCounter
        >= process.instructions.length
    ) {
      process.state = 'FINISHED'
    } else {
      process.state = 'READY'
    }

    return true
  } catch (error) {
    process.state = 'READY'
    throw error
  }
}

  getSnapshot(): SimulationSnapshot {
    return {
      stepCount: this.state.stepCount,

      sharedMemory: structuredClone(
        this.state.program.sharedMemory,
      ),

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
        }),
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
    ] = loop.values[loop.index]

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

    process.executionStack.splice(
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

    process.executionStack.splice(
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

      if (mode === 'FUNCTION_RETURN') {
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
    const functionFrame =
      process.callStack[
        process.callStack.length - 1
      ]

    return functionFrame?.localMemory
      ?? process.localMemory
  }

  private executeReturn(
    process: Process,
    expression?: Expression,
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

      if (
        frame?.completionMode
        === 'FUNCTION_RETURN'
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

    evaluation.pendingExpression = {
      expression: pending.expression,
      activeCall: functionCall,
    }

    this.startFunctionCallExpression(
      process,
      functionCall,
    )
  }

  private startFunctionCallExpression(
    process: Process,
    expression: FunctionCallExpression,
  ): void {
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

    const localMemory =
      this.getActiveLocalMemory(process)

    const argumentValues =
      expression.arguments.map(
        (argument) =>
          evaluateExpression(
            argument,
            {
              localMemory,
              sharedMemory:
                this.state.program.sharedMemory,
            },
          ),
      )

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
    const evaluation =
      process.pendingEvaluations.pop()

    if (!evaluation) {
      throw new Error(
        'Missing pending evaluation',
      )
    }

    const pending =
      evaluation.pendingInstruction

    process.expressionRuntimeStatus =
      process.pendingEvaluations.length > 0
        ? 'WAITING_FOR_FUNCTION'
        : 'IDLE'

    switch (pending.type) {
      case 'DECLARE':
        if (pending.scope === 'LOCAL') {
          this.getActiveLocalMemory(process)[
            pending.name
          ] = value
        } else {
          this.state.program.sharedMemory[
            pending.name
          ] = value
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
        this.applyArrayAssignment(
          process,
          pending.arrayName,
          value,
          pending.value,
        )

        this.advanceProcess(process)
        return
    }
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

    const index = evaluateExpression(
      target.index,
      {
        localMemory:
          this.getActiveLocalMemory(process),
        sharedMemory:
          this.state.program.sharedMemory,
      },
    )

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
    ] = collection[0]

    process.executionStack.push({
      instructions: instruction.body,
      programCounter: 0,
      completionMode: 'FOREACH_NEXT',
      foreachLoop: {
        itemName: instruction.itemName,
        values: [...collection],
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

    if (Array.isArray(value)) {
      throw new Error(
        'Nested arrays are not supported yet',
      )
    }

    array[index] = value
  }

  private completeAssignmentValue(
    process: Process,
    target: AssignmentTarget,
    value: RuntimeValue,
  ): void {
    if (
      target.type === 'ARRAY_ACCESS'
      && this.containsFunctionCall(
        target.index,
      )
    ) {
      this.suspendExpression(
        process,
        target.index,
        {
          type: 'ASSIGN_TARGET_INDEX',
          arrayName: target.arrayName,
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

}
