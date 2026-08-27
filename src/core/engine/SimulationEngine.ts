import type { ExecutionState } from './ExecutionState'
import type { Scheduler } from '../scheduler/Scheduler'
import { evaluateExpression } from '../expressions/evaluateExpression'
import { writeVariable } from '../memory/writeVariable'
import type { SimulationSnapshot } from './SimulationSnapshot'
import type { Process } from '../process/Process'
import type { Instruction } from '../instructions/Instruction'

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
            localMemory: process.localMemory,
            sharedMemory: this.state.program.sharedMemory,
          },
        )

        if (instruction.target.type === 'VARIABLE') {
          writeVariable(
            instruction.target.name,
            value,
            process.localMemory,
            this.state.program.sharedMemory,
          )
        } else {
          const index = evaluateExpression(
            instruction.target.index,
            {
              localMemory: process.localMemory,
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

          const array =
            arrayName in process.localMemory
              ? process.localMemory[arrayName]
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
            localMemory: process.localMemory,
            sharedMemory: this.state.program.sharedMemory,
          },
        )

        if (instruction.scope === 'LOCAL') {
          process.localMemory[instruction.name] = value
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
            localMemory: process.localMemory,
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
            localMemory: process.localMemory,
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
              localMemory: process.localMemory,
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

    if (
      completedFrame.completionMode
      === 'CHECK_REPEAT_UNTIL'
    ) {
      const condition =
        completedFrame.repeatCondition

      if (!condition) {
        throw new Error(
          'Repeat frame is missing its condition',
        )
      }

      const result = evaluateExpression(
        condition,
        {
          localMemory: process.localMemory,
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

      return
    }

    if (
      completedFrame.completionMode
      === 'ADVANCE_PARENT'
    ) {
      this.advanceProcess(process)
    }
  }

}
