import type { ExecutionState } from './ExecutionState'
import type { Scheduler } from '../scheduler/Scheduler'
import { evaluateExpression } from '../expressions/evaluateExpression'
import { writeVariable } from '../memory/writeVariable'
import type { SimulationSnapshot } from './SimulationSnapshot'
import type { Process } from '../process/Process'
import type { Instruction } from '../instructions/Instruction'
import type { ExecutionFrame } from '../process/ExecutionFrame'
import type { RuntimeValue } from '../memory/RuntimeValue'
import type { Expression } from '../expressions/Expression'

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

  step(): void {
    if (this.state.stepCount >= this.maxSteps) {
      return
    }

    const process = this.scheduler.selectNext(
      this.state.program.processes,
    )

    if (!process) {
      return
    }

    process.state = 'RUNNING'

    const instruction = this.getCurrentInstruction(process)

    if (!instruction) {
      process.state = 'FINISHED'
      return
    }

    this.state.history.push({
      step: this.state.stepCount+1,
      processId: process.id,
      instructionType: instruction.type,
    })

    switch (instruction.type) {
      case 'NO_OP':
        this.advanceProcess(process)
        break

      case 'FINISH':
        process.programCounter++
        process.state = 'FINISHED'
        this.state.stepCount++
        return

      case 'ASSIGN': {
        const value = evaluateExpression(
          instruction.expression,
          {
            localMemory:this.getActiveLocalMemory(process),
            sharedMemory: this.state.program.sharedMemory,
          },
        )

        if (instruction.target.type === 'VARIABLE') {
          writeVariable(
            instruction.target.name,
            value,
            this.getActiveLocalMemory(process),
            this.state.program.sharedMemory,
          )
        } else {
          const index = evaluateExpression(
            instruction.target.index,
            {
              localMemory: this.getActiveLocalMemory(process),
              sharedMemory: this.state.program.sharedMemory,
            },
          )

          if (
            typeof index !== 'number'
            || !Number.isInteger(index)
          ) {
            throw new Error('Array index must be an integer')
          }

          const arrayName = instruction.target.arrayName

          const localMemory =
            this.getActiveLocalMemory(process)

          const array =
            arrayName in localMemory
              ? localMemory[arrayName]
              : this.state.program.sharedMemory[arrayName]

          if (!Array.isArray(array)) {
            throw new Error(`Variable "${arrayName}" is not an array`)
          }

          if (index < 0 || index >= array.length) {
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

        this.advanceProcess(process)
        break
      }
      case 'DECLARE': {
        const value = evaluateExpression(
          instruction.initialValue,
          {
            localMemory: this.getActiveLocalMemory(process),
            sharedMemory: this.state.program.sharedMemory,
          },
        )

        if (instruction.scope === 'LOCAL') {
          this.getActiveLocalMemory(process)[
            instruction.name
          ] = value
        } else {
          this.state.program.sharedMemory[instruction.name] = value
        }

        this.advanceProcess(process)
        break
      }

      case 'IF': {
        const condition = evaluateExpression(
          instruction.condition,
          {
            localMemory: this.getActiveLocalMemory(process),
            sharedMemory:
              this.state.program.sharedMemory,
          },
        )

        if (typeof condition !== 'boolean') {
          throw new Error(
            'IF condition must evaluate to boolean',
          )
        }

        const selectedBranch =
          condition
            ? instruction.thenBranch
            : instruction.elseBranch

        process.executionStack.push({
          instructions: selectedBranch,
          programCounter: 0,
          completionMode: 'ADVANCE_PARENT',
        })

        if (selectedBranch.length === 0) {
          process.executionStack.pop()
          this.advanceProcess(process)
        }

        break
      }
      case 'WHILE': {
        const condition = evaluateExpression(
          instruction.condition,
          {
            localMemory: this.getActiveLocalMemory(process),
            sharedMemory:
              this.state.program.sharedMemory,
          },
        )

        if (typeof condition !== 'boolean') {
          throw new Error(
            'WHILE condition must evaluate to boolean',
          )
        }

        if (!condition) {
          this.advanceProcess(process)
          break
        }

        if (instruction.body.length === 0) {
          break
        }

        process.executionStack.push({
          instructions: instruction.body,
          programCounter: 0,
          completionMode: 'REPEAT_PARENT',
        })

        break
      }

      case 'REPEAT_UNTIL': {
        if (instruction.body.length === 0) {
          const condition = evaluateExpression(
            instruction.condition,
            {
              localMemory: this.getActiveLocalMemory(process),
              sharedMemory:
                this.state.program.sharedMemory,
            },
          )

          if (typeof condition !== 'boolean') {
            throw new Error(
              'REPEAT UNTIL condition must evaluate to boolean',
            )
          }

          if (condition) {
            this.advanceProcess(process)
          }

          break
        }

        process.executionStack.push({
          instructions: instruction.body,
          programCounter: 0,
          completionMode: 'CHECK_REPEAT_UNTIL',
          repeatCondition: instruction.condition,
        })

        break
      }

      case 'FOREACH': {
        const collection = evaluateExpression(
          instruction.collection,
          {
            localMemory: this.getActiveLocalMemory(process),
            sharedMemory:
              this.state.program.sharedMemory,
          },
        )

        if (!Array.isArray(collection)) {
          throw new Error(
            'FOREACH collection must be an array',
          )
        }

        if (collection.length === 0) {
          this.advanceProcess(process)
          break
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
            increment: instruction.increment,
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

        const functionMemory: Record<
          string,
          RuntimeValue
        > = {}

        functionDefinition.parameters.forEach(
          (parameter, index) => {
            functionMemory[parameter] =
              structuredClone(argumentValues[index])
          },
        )

        process.callStack.push({
          functionName:
            functionDefinition.name,
          localMemory: functionMemory,
        })

        if (
          functionDefinition.body.length === 0
        ) {
          process.callStack.pop()
          this.advanceProcess(process)
          break
        }

        process.executionStack.push({
          instructions:
            functionDefinition.body,
          programCounter: 0,
          completionMode:
            'FUNCTION_RETURN',
        })

        break
      }

      case 'RETURN': {
        this.executeReturn(
          process,
          instruction.value,
        )

        break
      }
    }

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

    const condition = evaluateExpression(
      loop.condition,
      {
        localMemory: this.getActiveLocalMemory(process),
        sharedMemory:
          this.state.program.sharedMemory,
      },
    )

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
    const condition = frame.repeatCondition

    if (!condition) {
      throw new Error(
        'Repeat frame is missing its condition',
      )
    }

    const result = evaluateExpression(
      condition,
      {
        localMemory: this.getActiveLocalMemory(process),
        sharedMemory:
          this.state.program.sharedMemory,
      },
    )

    if (typeof result !== 'boolean') {
      throw new Error(
        'REPEAT UNTIL condition must evaluate to boolean',
      )
    }

    if (result) {
      this.advanceProcess(process)
    }
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
}
