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
      },
    ]

    const conflicts =
      findMemoryAccessConflicts(events)

    expect(conflicts).toHaveLength(1)
    expect(conflicts[0].first.step).toBe(1)
    expect(conflicts[0].second.step).toBe(2)
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
  })
})
