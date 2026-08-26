import { describe, expect, it } from 'vitest'
import type { Process } from '../../process/Process'
import { RandomScheduler } from '../RandomScheduler'

function createProcess(
  id: string,
  state: Process['state'] = 'READY',
): Process {
  return {
    id,
    state,
    programCounter: 0,
    instructions: [],
  }
}

describe('RandomScheduler', () => {
  it('only selects ready processes', () => {
    const processes = [
      createProcess('P1', 'BLOCKED'),
      createProcess('P2'),
      createProcess('P3', 'FINISHED'),
    ]

    const scheduler = new RandomScheduler(42)

    for (let i = 0; i < 20; i++) {
      expect(scheduler.selectNext(processes)?.id).toBe('P2')
    }
  })

  it('returns undefined when no process is ready', () => {
    const processes = [
      createProcess('P1', 'BLOCKED'),
      createProcess('P2', 'FINISHED'),
    ]

    const scheduler = new RandomScheduler(42)

    expect(scheduler.selectNext(processes)).toBeUndefined()
  })

  it('produces the same sequence with the same seed', () => {
    const processes = [
      createProcess('P1'),
      createProcess('P2'),
      createProcess('P3'),
    ]

    const firstScheduler = new RandomScheduler(42)
    const secondScheduler = new RandomScheduler(42)

    const firstSequence = Array.from(
      { length: 20 },
      () => firstScheduler.selectNext(processes)?.id,
    )

    const secondSequence = Array.from(
      { length: 20 },
      () => secondScheduler.selectNext(processes)?.id,
    )

    expect(firstSequence).toEqual(secondSequence)
  })

  it('produces different sequences with different seeds', () => {
    const processes = [
      createProcess('P1'),
      createProcess('P2'),
      createProcess('P3'),
    ]

    const firstScheduler = new RandomScheduler(42)
    const secondScheduler = new RandomScheduler(123)

    const firstSequence = Array.from(
      { length: 20 },
      () => firstScheduler.selectNext(processes)?.id,
    )

    const secondSequence = Array.from(
      { length: 20 },
      () => secondScheduler.selectNext(processes)?.id,
    )

    expect(firstSequence).not.toEqual(secondSequence)
  })
})
