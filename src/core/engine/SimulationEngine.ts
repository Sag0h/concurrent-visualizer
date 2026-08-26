import type { ExecutionState } from './ExecutionState'
import type { Scheduler } from '../scheduler/Scheduler'


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

    const instruction = process.instructions[process.programCounter]

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
        process.programCounter++
        break

      case 'FINISH':
        process.programCounter++
        process.state = 'FINISHED'
        this.state.stepCount++
        return
    }

    this.state.stepCount++

    if (process.programCounter >= process.instructions.length) {
      process.state = 'FINISHED'
    } else {
      process.state = 'READY'
    }
  }

}
