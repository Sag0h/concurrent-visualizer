import { describe, expect, it } from 'vitest'
import { parseProgram } from '../../language/parseProgram'
import { FirstReadyScheduler } from '../../scheduler/FirstReadyScheduler'
import { RandomScheduler } from '../../scheduler/RandomScheduler'
import { RoundRobinScheduler } from '../../scheduler/RoundRobinScheduler'
import { createExecutionState } from '../createExecutionState'
import type { EnabledTransition } from '../EnabledTransition'
import { SimulationEngine } from '../SimulationEngine'

const synchronizedCounterSource = `
  sem mutex = 1;
  shared int value = 0;

  process P1 {
    P(mutex);
    value = value + 1;
    V(mutex);
  }

  process P2 {
    P(mutex);
    value = value + 1;
    V(mutex);
  }
`

function roundRobinEngine(): SimulationEngine {
  return new SimulationEngine(
    createExecutionState(
      parseProgram(synchronizedCounterSource),
    ),
    new RoundRobinScheduler(),
    100,
  )
}

function transitionFor(
  engine: SimulationEngine,
  processId: string,
): EnabledTransition {
  const transition = engine
    .getEnabledTransitions()
    .find((candidate) => candidate.processId === processId)

  if (!transition) {
    throw new Error(`No transition for ${processId}`)
  }

  return transition
}

describe('SimulationEngine rewind', () => {
  it('reconstructs snapshots, blocking, history and focus for every earlier step', () => {
    const baseline = roundRobinEngine()
    const snapshots = [baseline.getSnapshot()]

    while (!baseline.isFinished()) {
      expect(baseline.step()).toBe(true)
      snapshots.push(baseline.getSnapshot())
    }

    for (
      let targetStep = snapshots.length - 2;
      targetStep >= 0;
      targetStep--
    ) {
      const engine = roundRobinEngine()

      while (!engine.isFinished()) {
        expect(engine.step()).toBe(true)
      }

      engine.rewindToStep(targetStep)

      expect(engine.getSnapshot())
        .toEqual(snapshots[targetStep])
      expect(engine.getState().history)
        .toHaveLength(targetStep)
    }
  })

  it('restores random scheduler position for the next step', () => {
    const source = `
      process P1 { int a = 1; int b = 2; int c = 3; }
      process P2 { int a = 4; int b = 5; int c = 6; }
      process P3 { int a = 7; int b = 8; int c = 9; }
    `
    const baseline = new SimulationEngine(
      createExecutionState(parseProgram(source)),
      new RandomScheduler(73),
    )
    const snapshots = [baseline.getSnapshot()]

    while (!baseline.isFinished()) {
      expect(baseline.step()).toBe(true)
      snapshots.push(baseline.getSnapshot())
    }

    const engine = new SimulationEngine(
      createExecutionState(parseProgram(source)),
      new RandomScheduler(73),
    )

    while (!engine.isFinished()) {
      expect(engine.step()).toBe(true)
    }

    engine.rewindToStep(4)
    expect(engine.getSnapshot()).toEqual(snapshots[4])

    expect(engine.step()).toBe(true)
    expect(engine.getSnapshot()).toEqual(snapshots[5])
  })

  it('steps back once and stops at the initial state', () => {
    const engine = roundRobinEngine()

    expect(engine.stepBack()).toBe(false)

    expect(engine.step()).toBe(true)
    expect(engine.getState().stepCount).toBe(1)

    expect(engine.stepBack()).toBe(true)
    expect(engine.getState().stepCount).toBe(0)
    expect(engine.getSnapshot().executionFocus)
      .toBeUndefined()
    expect(engine.stepBack()).toBe(false)
  })

  it('validates target steps without changing the engine', () => {
    const engine = roundRobinEngine()
    const initialSnapshot = engine.getSnapshot()

    expect(() => engine.rewindToStep(-1)).toThrow(
      'Cannot rewind from step 0 to step -1',
    )
    expect(() => engine.rewindToStep(0.5)).toThrow(
      'Rewind target step must be an integer',
    )
    expect(() => engine.rewindToStep(1)).toThrow(
      'Cannot rewind from step 0 to step 1',
    )
    expect(engine.getSnapshot()).toEqual(initialSnapshot)
  })

  it('leaves the original state intact when an explicit trace cannot be reproduced', () => {
    const engine = new SimulationEngine(
      createExecutionState(parseProgram(`
        process P1 { int first = 1; int second = 2; }
        process P2 { int first = 3; int second = 4; }
      `)),
      new FirstReadyScheduler(),
    )

    engine.stepTransition(transitionFor(engine, 'P2'))
    engine.stepTransition(transitionFor(engine, 'P2'))

    const originalSnapshot = engine.getSnapshot()

    expect(() => engine.rewindToStep(1)).toThrow(
      'Cannot reproduce execution trace at step 1',
    )
    expect(engine.getSnapshot()).toEqual(originalSnapshot)
  })
})
