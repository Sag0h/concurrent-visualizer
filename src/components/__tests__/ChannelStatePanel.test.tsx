import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { ChannelSnapshot } from '../../core/engine/SimulationSnapshot'
import { ChannelStatePanel } from '../ChannelStatePanel'

describe('ChannelStatePanel', () => {
  it('renders schemas, FIFO messages and pending receivers', () => {
    const channels: ChannelSnapshot[] = [{
      name: 'jobs',
      payloadTypes: [
        { kind: 'PRIMITIVE', primitiveType: 'int' },
        { kind: 'PRIMITIVE', primitiveType: 'string' },
      ],
      messages: [
        { values: [1, 'first'] },
        { values: [2, 'second'] },
      ],
      waitingProcessIds: ['Worker[0]', 'Worker[1]'],
    }]

    const markup = renderToStaticMarkup(
      <ChannelStatePanel channels={channels} />,
    )

    expect(markup).toContain('jobs')
    expect(markup).toContain('chan(int, string)')
    expect(markup).toContain('Front')
    expect(markup).toContain('#2')
    expect(markup).toContain('(1, &quot;first&quot;)')
    expect(markup).toContain('(2, &quot;second&quot;)')
    expect(markup).toContain('Worker[0]')
    expect(markup).toContain('Worker[1]')
    expect(markup).toContain('2 pending messages')
  })

  it('renders an explicit empty mailbox state', () => {
    const markup = renderToStaticMarkup(
      <ChannelStatePanel
        channels={[{
          name: 'replies[0]',
          payloadTypes: [{
            kind: 'PRIMITIVE',
            primitiveType: 'bool',
          }],
          messages: [],
          waitingProcessIds: [],
        }]}
      />,
    )

    expect(markup).toContain('No pending messages')
    expect(markup).toContain('Pending receivers')
    expect(markup).toContain('None')
  })
})
