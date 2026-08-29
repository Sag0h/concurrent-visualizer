import { describe, expect, it } from 'vitest'
import { createExecutionState } from '../../engine/createExecutionState'
import { SimulationEngine } from '../../engine/SimulationEngine'
import { parseProgram } from '../../language/parseProgram'
import { FirstReadyScheduler } from '../../scheduler/FirstReadyScheduler'
import { exploreForDeadlock } from '../exploreForDeadlock'
import { replayDeadlockCounterexample } from '../replayDeadlockCounterexample'

function createEngine(
  source: string,
  maxSteps = 100,
): SimulationEngine {
  return new SimulationEngine(
    createExecutionState(parseProgram(source)),
    new FirstReadyScheduler(),
    maxSteps,
  )
}

const hiddenDeadlockSource = `
  sem resourceA = 1;
  sem resourceB = 1;

  process P1 {
    P(resourceA);
    P(resourceB);
    V(resourceB);
    V(resourceA);
  }

  process P2 {
    P(resourceB);
    P(resourceA);
    V(resourceA);
    V(resourceB);
  }
`

describe('exploreForDeadlock', () => {
  it('finds a shortest hidden deadlock without mutating the original engine', () => {
    const engine = createEngine(hiddenDeadlockSource)

    const result = exploreForDeadlock(engine, {
      maxDepth: 10,
      maxStates: 200,
    })

    expect(result.status).toBe('FOUND')
    expect(result.limits).toEqual({
      maxDepth: 10,
      maxStates: 200,
    })
    expect(result.counterexample).toEqual(
      expect.objectContaining({
        kind: 'DEADLOCK',
        depth: 4,
        limits: {
          maxDepth: 10,
          maxStates: 200,
        },
      }),
    )
    expect(result.counterexample?.processChoices).toHaveLength(4)
    expect(result.counterexample?.diagnostic.kind).toBe(
      'CIRCULAR_WAIT',
    )
    expect(result.statistics.maximumDepthReached).toBe(4)
    expect(result.statistics.visitedStateCount).toBeGreaterThan(1)
    expect(result.statistics.exploredTransitionCount).toBeGreaterThan(1)
    expect(engine.getState().stepCount).toBe(0)
    expect(engine.getState().history).toEqual([])
  })

  it('replays the exact process sequence to the recorded deadlock', () => {
    const engine = createEngine(hiddenDeadlockSource)
    const result = exploreForDeadlock(engine, {
      maxDepth: 10,
      maxStates: 200,
    })

    if (!result.counterexample) {
      throw new Error('Expected a deadlock counterexample')
    }

    const replay = replayDeadlockCounterexample(
      engine,
      result.counterexample,
    )

    expect(replay.isDeadlocked()).toBe(true)
    expect(
      replay.getState().history.map(
        (event) => event.processId,
      ),
    ).toEqual(result.counterexample.processChoices)
    expect(replay.getState()).toEqual(
      result.counterexample.terminalState,
    )
    expect(engine.getState().stepCount).toBe(0)
  })

  it('also admits a terminating trace for the hidden-deadlock program', () => {
    const engine = createEngine(hiddenDeadlockSource)

    for (const processId of [
      'P1', 'P1', 'P1', 'P1',
      'P2', 'P2', 'P2', 'P2',
    ]) {
      const transition = engine
        .getEnabledTransitions()
        .find((candidate) => candidate.processId === processId)

      if (!transition) {
        throw new Error(`Expected ${processId} to be enabled`)
      }

      engine.stepTransition(transition)
    }

    expect(engine.isFinished()).toBe(true)
    expect(engine.isDeadlocked()).toBe(false)
  })

  it('exhausts a finite safe state space', () => {
    const engine = createEngine(`
      process P1 {
        int value = 1;
      }

      process P2 {
        int value = 2;
      }
    `)

    const result = exploreForDeadlock(engine, {
      maxDepth: 4,
      maxStates: 20,
    })

    expect(result.status).toBe('EXHAUSTED')
    expect(result.counterexample).toBeUndefined()
    expect(result.truncationReasons).toEqual([])
    expect(result.statistics.visitedStateCount).toBe(4)
    expect(result.statistics.exploredTransitionCount).toBe(4)
  })

  it('exhausts a repeated non-terminating semantic state', () => {
    const engine = createEngine(`
      process Spinner {
        while (true) { }
      }
    `)

    const result = exploreForDeadlock(engine, {
      maxDepth: 100,
      maxStates: 100,
    })

    expect(result.status).toBe('EXHAUSTED')
    expect(result.statistics).toEqual({
      visitedStateCount: 1,
      exploredTransitionCount: 1,
      maximumDepthReached: 1,
    })
  })

  it('reports truncation when a branch continues beyond maxDepth', () => {
    const engine = createEngine(`
      process P1 {
        int first = 1;
        int second = 2;
      }
    `)

    const result = exploreForDeadlock(engine, {
      maxDepth: 1,
      maxStates: 20,
    })

    expect(result.status).toBe('TRUNCATED')
    expect(result.truncationReasons).toContain('MAX_DEPTH')
    expect(result.statistics.maximumDepthReached).toBe(1)
  })

  it('reports truncation before registering more than maxStates', () => {
    const engine = createEngine(`
      process P1 {
        int value = 1;
      }

      process P2 {
        int value = 2;
      }
    `)

    const result = exploreForDeadlock(engine, {
      maxDepth: 4,
      maxStates: 1,
    })

    expect(result.status).toBe('TRUNCATED')
    expect(result.truncationReasons).toEqual([
      'MAX_STATES',
    ])
    expect(result.statistics.visitedStateCount).toBe(1)
  })

  it('reports the engine safety limit as truncation', () => {
    const engine = createEngine(`
      process P1 {
        int first = 1;
        int second = 2;
      }
    `, 1)

    const result = exploreForDeadlock(engine, {
      maxDepth: 10,
      maxStates: 20,
    })

    expect(result.status).toBe('TRUNCATED')
    expect(result.truncationReasons).toContain(
      'ENGINE_STEP_LIMIT',
    )
  })

  it('finds a deadlock already present at the initial state', () => {
    const engine = createEngine(`
      sem unavailable = 0;

      process Blocked {
        P(unavailable);
      }
    `)

    engine.step()

    const result = exploreForDeadlock(engine, {
      maxDepth: 0,
      maxStates: 1,
    })

    expect(result.status).toBe('FOUND')
    expect(result.counterexample?.depth).toBe(0)
    expect(result.counterexample?.processChoices).toEqual([])
  })

  it('rejects invalid limits', () => {
    const engine = createEngine(`process P1 { }`)

    expect(() => exploreForDeadlock(engine, {
      maxDepth: -1,
      maxStates: 1,
    })).toThrowError(
      'Exploration maxDepth must be a non-negative integer',
    )
    expect(() => exploreForDeadlock(engine, {
      maxDepth: 1,
      maxStates: 0,
    })).toThrowError(
      'Exploration maxStates must be a positive integer',
    )
  })

  it('rejects replay from a different initial state', () => {
    const engine = createEngine(hiddenDeadlockSource)
    const result = exploreForDeadlock(engine, {
      maxDepth: 10,
      maxStates: 200,
    })

    if (!result.counterexample) {
      throw new Error('Expected a deadlock counterexample')
    }

    const differentEngine = createEngine(`
      process Different { }
    `)

    expect(() => replayDeadlockCounterexample(
      differentEngine,
      result.counterexample!,
    )).toThrowError(
      'Counterexample does not start from the supplied engine state',
    )
  })
})
