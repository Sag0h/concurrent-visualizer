import { describe, expect, it } from 'vitest'
import type { Process } from '../../process/Process'
import { RoundRobinScheduler } from '../RoundRobinScheduler'

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

describe('RoundRobinScheduler', () => {
  it('selects ready processes in round-robin order', () => {
    const processes = [
      createProcess('P1'),
      createProcess('P2'),
      createProcess('P3'),
    ]

    const scheduler = new RoundRobinScheduler()

    expect(scheduler.selectNext(processes)?.id).toBe('P1')
    expect(scheduler.selectNext(processes)?.id).toBe('P2')
    expect(scheduler.selectNext(processes)?.id).toBe('P3')
    expect(scheduler.selectNext(processes)?.id).toBe('P1')
  })

  it('skips processes that are not ready', () => {
    const processes = [
      createProcess('P1'),
      createProcess('P2', 'BLOCKED'),
      createProcess('P3'),
    ]

    const scheduler = new RoundRobinScheduler()

    expect(scheduler.selectNext(processes)?.id).toBe('P1')
    expect(scheduler.selectNext(processes)?.id).toBe('P3')
    expect(scheduler.selectNext(processes)?.id).toBe('P1')
  })

  it('returns undefined when no process is ready', () => {
    const processes = [
      createProcess('P1', 'BLOCKED'),
      createProcess('P2', 'FINISHED'),
    ]

    const scheduler = new RoundRobinScheduler()

    expect(scheduler.selectNext(processes)).toBeUndefined()
  })

  it('returns undefined when there are no processes', () => {
    const scheduler = new RoundRobinScheduler()

    expect(scheduler.selectNext([])).toBeUndefined()
  })
})
