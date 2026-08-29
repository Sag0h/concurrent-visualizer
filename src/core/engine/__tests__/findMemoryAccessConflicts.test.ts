import { describe, expect, it } from 'vitest'
import type { MicroOperationEvent } from '../MicroOperationEvent'
import { findMemoryAccessConflicts } from '../findMemoryAccessConflicts'
import { parseProgram } from '../../language/parseProgram'
import { SimulationEngine } from '../SimulationEngine'
import { createExecutionState } from '../createExecutionState'
import { RoundRobinScheduler } from '../../scheduler/RoundRobinScheduler'

describe('findMemoryAccessConflicts', () => {
  it('detects accesses from different processes to the same variable when one writes', () => {
    const events: MicroOperationEvent[] = [
      {
        step: 1,
        processId: 'P1',
        type: 'SHARED_READ',
        description: 'x = 0',
        location: {
          type: 'VARIABLE',
          name: 'x',
        },
        atomicDepth: 0,
      },
      {
        step: 2,
        processId: 'P2',
        type: 'SHARED_WRITE',
        description: 'x = 1',
        location: {
          type: 'VARIABLE',
          name: 'x',
        },
        atomicDepth: 0,
      },
    ]

    const conflicts =
      findMemoryAccessConflicts(events)

    expect(conflicts).toHaveLength(1)
    expect(conflicts[0].first.step).toBe(1)
    expect(conflicts[0].second.step).toBe(2)
    expect(conflicts[0].diagnostic).toBe(
      'POTENTIAL_DATA_RACE',
    )
  })

  it('does not treat two reads as a conflict', () => {
    const events: MicroOperationEvent[] = [
      {
        step: 1,
        processId: 'P1',
        type: 'SHARED_READ',
        description: 'x = 0',
        location: {
          type: 'VARIABLE',
          name: 'x',
        },
        atomicDepth: 0,
      },
      {
        step: 2,
        processId: 'P2',
        type: 'SHARED_READ',
        description: 'x = 0',
        location: {
          type: 'VARIABLE',
          name: 'x',
        },
        atomicDepth: 0,
      },
    ]

    expect(
      findMemoryAccessConflicts(events),
    ).toHaveLength(0)
  })

  it('distinguishes different array elements', () => {
    const events: MicroOperationEvent[] = [
      {
        step: 1,
        processId: 'P1',
        type: 'SHARED_WRITE',
        description: 'values[0] = 1',
        location: {
          type: 'ARRAY_ELEMENT',
          arrayName: 'values',
          index: 0,
        },
        atomicDepth: 0,
      },
      {
        step: 2,
        processId: 'P2',
        type: 'SHARED_WRITE',
        description: 'values[1] = 1',
        location: {
          type: 'ARRAY_ELEMENT',
          arrayName: 'values',
          index: 1,
        },
        atomicDepth: 0,
      },
    ]

    expect(
      findMemoryAccessConflicts(events),
    ).toHaveLength(0)
  })

  it('detects conflicting accesses to the same array element', () => {
    const events: MicroOperationEvent[] = [
      {
        step: 1,
        processId: 'P1',
        type: 'SHARED_READ',
        description: 'values[0] = 0',
        location: {
          type: 'ARRAY_ELEMENT',
          arrayName: 'values',
          index: 0,
        },
        atomicDepth: 0,
      },
      {
        step: 2,
        processId: 'P2',
        type: 'SHARED_WRITE',
        description: 'values[0] = 1',
        location: {
          type: 'ARRAY_ELEMENT',
          arrayName: 'values',
          index: 0,
        },
        atomicDepth: 0,
      },
    ]

    expect(
      findMemoryAccessConflicts(events),
    ).toHaveLength(1)
  })

  it('summarizes memory access conflicts by location', () => {
    const source = `
      shared int x = 0;

      process P1 {
        x = x + 1;
      }

      process P2 {
        x = x + 1;
      }
    `

    const program = parseProgram(source)

    const engine = new SimulationEngine(
      createExecutionState(program),
      new RoundRobinScheduler(),
    )

    while (!engine.isFinished()) {
      const progressed = engine.step()

      if (!progressed) {
        break
      }
    }

    const snapshot = engine.getSnapshot()

    expect(
      snapshot.memoryConflictSummaries,
    ).toHaveLength(1)

    expect(
      snapshot.memoryConflictSummaries[0],
    ).toMatchObject({
      location: {
        type: 'VARIABLE',
        name: 'x',
      },
    })

    expect(
      snapshot.memoryConflictSummaries[0]
        .processes,
    ).toEqual(
      expect.arrayContaining([
        'P1',
        'P2',
      ]),
    )

    expect(
      snapshot.memoryConflictSummaries[0]
        .conflictCount,
    ).toBeGreaterThan(0)
    expect(
      snapshot.memoryConflictSummaries[0]
        .potentialRaceCount,
    ).toBeGreaterThan(0)
    expect(
      snapshot.memoryConflictSummaries[0]
        .mutualExclusionViolationCount,
    ).toBe(0)
  })

  it('classifies accesses inside atomic sections as synchronized', () => {
    const events = [
      {
        step: 1,
        processId: 'P1',
        type: 'SHARED_WRITE' as const,
        description: 'x = 1',
        location: {
          type: 'VARIABLE' as const,
          name: 'x',
        },
        atomicDepth: 1,
      },
      {
        step: 2,
        processId: 'P2',
        type: 'SHARED_WRITE' as const,
        description: 'x = 2',
        location: {
          type: 'VARIABLE' as const,
          name: 'x',
        },
        atomicDepth: 1,
      },
    ]

    const conflicts =
      findMemoryAccessConflicts(events)

    expect(conflicts).toHaveLength(1)

    expect(
      conflicts[0].classification,
    ).toBe('SYNCHRONIZED')
    expect(conflicts[0].diagnostic).toBe(
      'SYNCHRONIZED_ACCESS',
    )
  })

  it('keeps conflict as potential race when only one access is atomic', () => {
    const events = [
      {
        step: 1,
        processId: 'P1',
        type: 'SHARED_WRITE' as const,
        description: 'x = 1',
        location: {
          type: 'VARIABLE' as const,
          name: 'x',
        },
        atomicDepth: 1,
      },
      {
        step: 2,
        processId: 'P2',
        type: 'SHARED_WRITE' as const,
        description: 'x = 2',
        location: {
          type: 'VARIABLE' as const,
          name: 'x',
        },
        atomicDepth: 0,
      },
    ]

    const conflicts =
      findMemoryAccessConflicts(events)

    expect(
      conflicts[0].classification,
    ).toBe('POTENTIAL_RACE')
    expect(conflicts[0]).toMatchObject({
      diagnostic: 'POTENTIAL_DATA_RACE',
      reason: {
        type: 'INCONSISTENT_PROTECTION',
        first: {
          atomicRegion: true,
        },
        second: {
          atomicRegion: false,
        },
      },
    })
  })

  it('recognizes a general semaphore used as a mutex in the observed execution', () => {
    const source = `
      sem mutex = 1;
      shared int x = 0;

      process P1 {
        P(mutex);
        x = x + 1;
        V(mutex);
      }

      process P2 {
        P(mutex);
        x = x + 1;
        V(mutex);
      }
    `

    const engine = new SimulationEngine(
      createExecutionState(parseProgram(source)),
      new RoundRobinScheduler(),
    )

    while (!engine.isFinished()) {
      if (!engine.step()) {
        break
      }
    }

    const conflicts =
      engine.getSnapshot().memoryAccessConflicts

    expect(conflicts.length).toBeGreaterThan(0)
    expect(
      conflicts.every(
        (conflict) =>
          conflict.classification
            === 'SYNCHRONIZED',
      ),
    ).toBe(true)
    expect(conflicts[0].reason).toEqual({
      type: 'SEMAPHORE_MUTEX',
      semaphoreName: 'mutex',
    })
  })

  it('keeps unilateral semaphore protection as a potential race', () => {
    const source = `
      sem mutex = 1;
      shared int x = 0;

      process P1 {
        P(mutex);
        x = x + 1;
        V(mutex);
      }

      process P2 {
        x = x + 1;
      }
    `

    const engine = new SimulationEngine(
      createExecutionState(parseProgram(source)),
      new RoundRobinScheduler(),
    )

    while (!engine.isFinished()) {
      if (!engine.step()) {
        break
      }
    }

    const conflicts =
      engine.getSnapshot().memoryAccessConflicts

    expect(conflicts.length).toBeGreaterThan(0)
    expect(
      conflicts.every(
        (conflict) =>
          conflict.classification
            === 'POTENTIAL_RACE',
      ),
    ).toBe(true)
    expect(
      conflicts.some(
        (conflict) =>
          conflict.diagnostic
            === 'MUTUAL_EXCLUSION_VIOLATION'
          && conflict.reason.type
            === 'OBSERVED_MUTEX_OVERLAP',
      ),
    ).toBe(true)
  })

  it('diagnoses overlapping critical sections protected by different mutexes', () => {
    const source = `
      sem mutexA = 1;
      sem mutexB = 1;
      shared int x = 0;

      process P1 {
        P(mutexA);
        x = x + 1;
        V(mutexA);
      }

      process P2 {
        P(mutexB);
        x = x + 1;
        V(mutexB);
      }
    `

    const engine = new SimulationEngine(
      createExecutionState(parseProgram(source)),
      new RoundRobinScheduler(),
    )

    while (!engine.isFinished()) {
      if (!engine.step()) {
        break
      }
    }

    const conflicts =
      engine.getSnapshot().memoryAccessConflicts

    expect(conflicts.length).toBeGreaterThan(0)
    expect(
      conflicts.some(
        (conflict) =>
          conflict.diagnostic
            === 'MUTUAL_EXCLUSION_VIOLATION',
      ),
    ).toBe(true)
    expect(
      conflicts.find(
        (conflict) =>
          conflict.diagnostic
            === 'MUTUAL_EXCLUSION_VIOLATION',
      )?.reason,
    ).toMatchObject({
      type: 'OBSERVED_MUTEX_OVERLAP',
      first: {
        mutexSemaphoreNames: ['mutexA'],
      },
      second: {
        mutexSemaphoreNames: ['mutexB'],
      },
    })
    expect(
      engine.getSnapshot().memoryConflictSummaries[0]
        .mutualExclusionViolationCount,
    ).toBeGreaterThan(0)
  })

  it('does not mistake a counting semaphore for a mutex', () => {
    const source = `
      sem permits = 2;
      shared int x = 0;

      process P1 {
        P(permits);
        x = x + 1;
        V(permits);
      }

      process P2 {
        P(permits);
        x = x + 1;
        V(permits);
      }
    `

    const engine = new SimulationEngine(
      createExecutionState(parseProgram(source)),
      new RoundRobinScheduler(),
    )

    while (!engine.isFinished()) {
      if (!engine.step()) {
        break
      }
    }

    const conflicts =
      engine.getSnapshot().memoryAccessConflicts

    expect(conflicts.length).toBeGreaterThan(0)
    expect(
      conflicts.every(
        (conflict) =>
          conflict.classification === 'UNKNOWN',
      ),
    ).toBe(true)
    expect(
      conflicts.every(
        (conflict) =>
          conflict.diagnostic
            === 'AMBIGUOUS_SYNCHRONIZATION',
      ),
    ).toBe(true)
    expect(conflicts[0].reason).toEqual({
      type: 'AMBIGUOUS_SEMAPHORE_PROTOCOL',
      semaphoreNames: ['permits'],
    })
  })

  it('marks an observed extra V as an ambiguous semaphore protocol', () => {
    const source = `
      sem mutex = 1;
      shared int x = 0;

      process P1 {
        V(mutex);
        P(mutex);
        x = x + 1;
      }

      process P2 {
        P(mutex);
        x = x + 1;
      }
    `

    const engine = new SimulationEngine(
      createExecutionState(parseProgram(source)),
      new RoundRobinScheduler(),
    )

    while (!engine.isFinished()) {
      if (!engine.step()) {
        break
      }
    }

    const conflicts =
      engine.getSnapshot().memoryAccessConflicts

    expect(conflicts.length).toBeGreaterThan(0)
    expect(
      conflicts.some(
        (conflict) =>
          conflict.classification === 'UNKNOWN',
      ),
    ).toBe(true)
  })

  it('recognizes a direct signaling handoff that orders two accesses', () => {
    const source = `
      sem listo = 0;
      shared int dato = 0;
      shared int recibido = 0;

      process Productor {
        dato = 42;
        V(listo);
      }

      process Consumidor {
        P(listo);
        recibido = dato;
      }
    `

    const engine = new SimulationEngine(
      createExecutionState(parseProgram(source)),
      new RoundRobinScheduler(),
    )

    while (!engine.isFinished()) {
      if (!engine.step()) {
        break
      }
    }

    const conflicts =
      engine.getSnapshot().memoryAccessConflicts

    expect(conflicts).toHaveLength(1)
    expect(conflicts[0]).toMatchObject({
      classification: 'SYNCHRONIZED',
      reason: {
        type: 'SEMAPHORE_SIGNALING',
        semaphoreName: 'listo',
      },
    })
  })

  it('does not infer ordering when the signal occurs before the write', () => {
    const source = `
      sem listo = 0;
      shared int dato = 0;
      shared int recibido = 0;

      process Productor {
        V(listo);
        dato = 42;
      }

      process Consumidor {
        P(listo);
        recibido = dato;
      }
    `

    const engine = new SimulationEngine(
      createExecutionState(parseProgram(source)),
      new RoundRobinScheduler(),
    )

    while (!engine.isFinished()) {
      if (!engine.step()) {
        break
      }
    }

    expect(
      engine.getSnapshot().memoryAccessConflicts,
    ).toEqual([
      expect.objectContaining({
        classification: 'POTENTIAL_RACE',
        diagnostic: 'POTENTIAL_DATA_RACE',
        reason: expect.objectContaining({
          type: 'INCONSISTENT_PROTECTION',
        }),
      }),
    ])
  })
})
