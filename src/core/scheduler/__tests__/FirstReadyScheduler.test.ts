import { describe, expect, it } from 'vitest'
import type { Process } from '../../process/Process'
import { FirstReadyScheduler } from '../FirstReadyScheduler'

function createProcess(
  id: string,
  state: Process['state'] = 'READY',
): Process {
  return {
    id,
    state,
    programCounter: 0,
    instructions: [],
    localMemory: {},
    executionStack: [],
    callStack: [],
  }
}

describe('FirstReadyScheduler', () => {
  it('selects the first ready process', () => {
    const processes = [
      createProcess('P1', 'BLOCKED'),
      createProcess('P2'),
      createProcess('P3'),
    ]

    const scheduler = new FirstReadyScheduler()

    expect(scheduler.selectNext(processes)?.id).toBe('P2')
  })

  it('returns undefined when no process is ready', () => {
    const processes = [
      createProcess('P1', 'BLOCKED'),
      createProcess('P2', 'FINISHED'),
    ]

    const scheduler = new FirstReadyScheduler()

    expect(scheduler.selectNext(processes)).toBeUndefined()
  })

  it('keeps the same behavior after reset', () => {
    const processes = [
      createProcess('P1'),
      createProcess('P2'),
    ]

    const scheduler = new FirstReadyScheduler()

    expect(scheduler.selectNext(processes)?.id).toBe('P1')

    scheduler.reset()

    expect(scheduler.selectNext(processes)?.id).toBe('P1')
  })
})
