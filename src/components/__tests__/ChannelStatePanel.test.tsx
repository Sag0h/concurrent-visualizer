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

  it('highlights a successful send and the newly appended message', () => {
    const markup = renderToStaticMarkup(
      <ChannelStatePanel
        channels={[{
          name: 'jobs',
          payloadTypes: [{
            kind: 'PRIMITIVE',
            primitiveType: 'int',
          }],
          messages: [
            { values: [1] },
            { values: [2] },
          ],
          waitingProcessIds: [],
        }]}
        activity={{
          step: 4,
          processId: 'Producer',
          event: {
            operation: 'SEND',
            channelName: 'jobs',
            status: 'SUCCEEDED',
            messageCountBefore: 1,
            messageCountAfter: 2,
            values: [2],
          },
        }}
      />,
    )

    expect(markup).toContain('channel-card-active-send')
    expect(markup).toContain('Message sent')
    expect(markup).toContain('Producer → mailbox')
    expect(markup.match(/channel-message-just-sent/g)).toHaveLength(1)
  })

  it('shows a blocked receive without marking a message as moved', () => {
    const markup = renderToStaticMarkup(
      <ChannelStatePanel
        channels={[{
          name: 'replies[0]',
          payloadTypes: [{
            kind: 'PRIMITIVE',
            primitiveType: 'string',
          }],
          messages: [],
          waitingProcessIds: ['Client'],
        }]}
        activity={{
          step: 2,
          processId: 'Client',
          event: {
            operation: 'RECEIVE',
            channelName: 'replies[0]',
            status: 'BLOCKED',
            messageCountBefore: 0,
            messageCountAfter: 0,
          },
        }}
      />,
    )

    expect(markup).toContain('channel-card-active-blocked')
    expect(markup).toContain('Receive blocked')
    expect(markup).toContain('Client waiting for a message')
    expect(markup).not.toContain('channel-message-just-sent')
  })

  it('shows a successful receive moving from the mailbox to the process', () => {
    const markup = renderToStaticMarkup(
      <ChannelStatePanel
        channels={[{
          name: 'jobs',
          payloadTypes: [{
            kind: 'PRIMITIVE',
            primitiveType: 'int',
          }],
          messages: [],
          waitingProcessIds: [],
        }]}
        activity={{
          step: 3,
          processId: 'Worker',
          event: {
            operation: 'RECEIVE',
            channelName: 'jobs',
            status: 'SUCCEEDED',
            messageCountBefore: 1,
            messageCountAfter: 0,
            values: [9],
          },
        }}
      />,
    )

    expect(markup).toContain('channel-card-active-receive')
    expect(markup).toContain('channel-card-active-succeeded')
    expect(markup).toContain('Message received')
    expect(markup).toContain('mailbox → Worker')
  })
})
