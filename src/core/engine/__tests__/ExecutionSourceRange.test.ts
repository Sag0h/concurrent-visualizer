import { describe, expect, it } from 'vitest'
import { parseProgram } from '../../language/parseProgram'
import { FirstReadyScheduler } from '../../scheduler/FirstReadyScheduler'
import { createExecutionState } from '../createExecutionState'
import { SimulationEngine } from '../SimulationEngine'

describe('execution source range', () => {
  it('exposes the executed instruction and restores it on Step Back', () => {
    const source = `process Worker {
  int value = 1;
  print(value);
}`
    const engine = new SimulationEngine(
      createExecutionState(parseProgram(source)),
      new FirstReadyScheduler(),
    )

    engine.step()
    expect(activeSource(source, engine)).toBe(
      'int value = 1;',
    )
    expect(
      engine.getSnapshot().executionFocus?.sourceRange?.start.line,
    ).toBe(2)

    engine.step()
    expect(activeSource(source, engine)).toBe(
      'print(value);',
    )

    engine.stepBack()
    expect(activeSource(source, engine)).toBe(
      'int value = 1;',
    )
  })

  it('leaves source range absent for programmatic instructions', () => {
    const engine = new SimulationEngine(
      createExecutionState({
        processes: [{
          id: 'Worker',
          state: 'READY',
          programCounter: 0,
          instructions: [{ type: 'NO_OP' }],
          localMemory: {},
          executionStack: [],
          callStack: [],
          expressionRuntimeStatus: 'IDLE',
          pendingEvaluations: [],
          atomicDepth: 0,
        }],
        sharedMemory: {},
      }),
      new FirstReadyScheduler(),
    )

    engine.step()

    expect(
      engine.getSnapshot().executionFocus?.sourceRange,
    ).toBeUndefined()
  })
})

function activeSource(
  source: string,
  engine: SimulationEngine,
): string | undefined {
  const range =
    engine.getSnapshot().executionFocus?.sourceRange

  return range
    ? source.slice(range.start.offset, range.end.offset)
    : undefined
}
