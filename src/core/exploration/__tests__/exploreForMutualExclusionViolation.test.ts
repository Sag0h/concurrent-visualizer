import { describe, expect, it } from 'vitest'
import { createExecutionState } from '../../engine/createExecutionState'
import { SimulationEngine } from '../../engine/SimulationEngine'
import { parseProgram } from '../../language/parseProgram'
import { FirstReadyScheduler } from '../../scheduler/FirstReadyScheduler'
import { exploreForMutualExclusionViolation } from '../exploreForMutualExclusionViolation'
import { replayMutualExclusionViolationCounterexample } from '../replayMutualExclusionViolationCounterexample'

function createEngine(source: string): SimulationEngine {
  return new SimulationEngine(
    createExecutionState(parseProgram(source)),
    new FirstReadyScheduler(),
    100,
  )
}

const differentMutexesSource = `
  sem mutexA = 1;
  sem mutexB = 1;
  shared int value = 0;

  process P1 {
    P(mutexA);
    value = value + 1;
    V(mutexA);
  }

  process P2 {
    P(mutexB);
    value = value + 1;
    V(mutexB);
  }
`

describe('exploreForMutualExclusionViolation', () => {
  it('finds a shortest overlap protected by different mutexes', () => {
    const engine = createEngine(
      differentMutexesSource,
    )

    const result =
      exploreForMutualExclusionViolation(
        engine,
        {
          maxDepth: 12,
          maxStates: 2000,
        },
      )

    expect(result.status).toBe('FOUND')
    expect(result.counterexample).toEqual(
      expect.objectContaining({
        kind: 'MUTUAL_EXCLUSION_VIOLATION',
        depth: 6,
      }),
    )
    expect(
      result.counterexample?.diagnostic,
    ).toEqual(
      expect.objectContaining({
        diagnostic:
          'MUTUAL_EXCLUSION_VIOLATION',
        classification: 'POTENTIAL_RACE',
        reason: expect.objectContaining({
          type: 'OBSERVED_MUTEX_OVERLAP',
        }),
      }),
    )
    expect(engine.getState().stepCount).toBe(0)
  })

  it('replays the exact violating interleaving', () => {
    const engine = createEngine(
      differentMutexesSource,
    )
    const result =
      exploreForMutualExclusionViolation(
        engine,
        {
          maxDepth: 12,
          maxStates: 2000,
        },
      )

    if (!result.counterexample) {
      throw new Error(
        'Expected a mutual exclusion counterexample',
      )
    }

    const replay =
      replayMutualExclusionViolationCounterexample(
        engine,
        result.counterexample,
      )
    const violations = replay
      .getSnapshot()
      .memoryAccessConflicts
      .filter(
        (conflict) =>
          conflict.diagnostic
            === 'MUTUAL_EXCLUSION_VIOLATION',
      )

    expect(violations).toHaveLength(1)
    expect(
      replay.getState().history.map(
        (event) => event.processId,
      ),
    ).toEqual(result.counterexample.processChoices)
    expect(engine.getState().stepCount).toBe(0)
  })

  it('exhausts a program protected by the same mutex', () => {
    const engine = createEngine(`
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
    `)

    const result =
      exploreForMutualExclusionViolation(
        engine,
        {
          maxDepth: 16,
          maxStates: 4000,
        },
      )

    expect(result.status).toBe('EXHAUSTED')
    expect(result.counterexample).toBeUndefined()
    expect(result.truncationReasons).toEqual([])
  })

  it('does not promote an unprotected potential race to a violation', () => {
    const engine = createEngine(`
      shared int value = 0;

      process P1 {
        value = value + 1;
      }

      process P2 {
        value = value + 1;
      }
    `)

    const result =
      exploreForMutualExclusionViolation(
        engine,
        {
          maxDepth: 10,
          maxStates: 1000,
        },
      )

    expect(result.status).toBe('EXHAUSTED')
    expect(result.counterexample).toBeUndefined()
  })
})
